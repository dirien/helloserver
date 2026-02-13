import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as docker_build from "@pulumi/docker-build";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const config = new pulumi.Config();
const stack = pulumi.getStack();
const projectName = "hello-server";

const clusterName = config.get("clusterName") || `${projectName}-${stack}`;
const instanceType = config.get("instanceType") || "t3.medium";
const desiredCapacity = config.getNumber("desiredCapacity") || 2;
const minSize = config.getNumber("minSize") || 1;
const maxSize = config.getNumber("maxSize") || 4;
const appVersion = config.get("appVersion") || "0.1.2";
const appReplicas = config.getNumber("appReplicas") || 2;

const tags: Record<string, string> = {
    Project: projectName,
    Environment: stack,
    ManagedBy: "Pulumi",
};

// ---------------------------------------------------------------------------
// 1. VPC — Isolated network with public + private subnets across 2 AZs
// ---------------------------------------------------------------------------
const vpc = new awsx.ec2.Vpc(`${projectName}-vpc`, {
    enableDnsHostnames: true,
    enableDnsSupport: true,
    numberOfAvailabilityZones: 2,
    subnetStrategy: awsx.ec2.SubnetAllocationStrategy.Auto,
    subnetSpecs: [
        { type: awsx.ec2.SubnetType.Public, name: "public" },
        { type: awsx.ec2.SubnetType.Private, name: "private" },
    ],
    natGateways: { strategy: awsx.ec2.NatGatewayStrategy.Single },
    tags: { ...tags, Name: `${projectName}-vpc` },
});

// ---------------------------------------------------------------------------
// 2. ECR — Private container registry for the hello-server image
// ---------------------------------------------------------------------------
const repo = new aws.ecr.Repository(`${projectName}-repo`, {
    name: `${projectName}`,
    imageTagMutability: "MUTABLE",
    imageScanningConfiguration: { scanOnPush: true },
    forceDelete: true,
    tags,
});

// ECR lifecycle policy — keep only last 10 images
new aws.ecr.LifecyclePolicy(`${projectName}-lifecycle`, {
    repository: repo.name,
    policy: JSON.stringify({
        rules: [
            {
                rulePriority: 1,
                description: "Keep only last 10 images",
                selection: {
                    tagStatus: "any",
                    countType: "imageCountMoreThan",
                    countNumber: 10,
                },
                action: { type: "expire" },
            },
        ],
    }),
});

// ---------------------------------------------------------------------------
// 3. Build & push the Docker image to ECR
// ---------------------------------------------------------------------------
const image = new docker_build.Image(`${projectName}-image`, {
    tags: [pulumi.interpolate`${repo.repositoryUrl}:v${appVersion}`],
    context: {
        location: "../hello-server",
    },
    dockerfile: {
        location: `../hello-server/DockerfileV${appVersion}`,
    },
    platforms: [docker_build.Platform.Linux_amd64],
    push: true,
    registries: [
        {
            address: repo.repositoryUrl,
            username: "AWS",
            password: aws.ecr.getAuthorizationTokenOutput({
                registryId: repo.registryId,
            }).password,
        },
    ],
});

// ---------------------------------------------------------------------------
// 4. EKS Cluster — Managed Kubernetes with a node group
// ---------------------------------------------------------------------------
const cluster = new eks.Cluster(`${projectName}-cluster`, {
    name: clusterName,
    vpcId: vpc.vpcId,
    publicSubnetIds: vpc.publicSubnetIds,
    privateSubnetIds: vpc.privateSubnetIds,
    instanceType: instanceType,
    desiredCapacity: desiredCapacity,
    minSize: minSize,
    maxSize: maxSize,
    nodeRootVolumeSize: 20,
    createOidcProvider: true,
    version: "1.31",
    tags,
});

// ---------------------------------------------------------------------------
// 5. Kubernetes Provider — uses the EKS kubeconfig
// ---------------------------------------------------------------------------
const k8sProvider = new k8s.Provider(`${projectName}-k8s`, {
    kubeconfig: cluster.kubeconfigJson,
});

// ---------------------------------------------------------------------------
// 6. Deploy hello-server via the existing Helm chart
// ---------------------------------------------------------------------------
const appNamespace = new k8s.core.v1.Namespace(
    `${projectName}-ns`,
    {
        metadata: { name: projectName },
    },
    { provider: k8sProvider },
);

const helmRelease = new k8s.helm.v3.Release(
    `${projectName}-helm`,
    {
        chart: "../delivery/charts/hello-server",
        namespace: appNamespace.metadata.name,
        values: {
            replicaCount: appReplicas,
            image: {
                repository: repo.repositoryUrl,
                tag: `v${appVersion}`,
                pullPolicy: "Always",
            },
            service: {
                type: "LoadBalancer",
                port: 9000,
            },
            resources: {
                requests: { cpu: "50m", memory: "64Mi" },
                limits: { cpu: "200m", memory: "128Mi" },
            },
        },
    },
    { provider: k8sProvider, dependsOn: [image] },
);

// ---------------------------------------------------------------------------
// 7. Retrieve the Service LoadBalancer hostname
// ---------------------------------------------------------------------------
const svc = k8s.core.v1.Service.get(
    `${projectName}-svc`,
    pulumi.interpolate`${appNamespace.metadata.name}/${helmRelease.status.name}`,
    { provider: k8sProvider },
);

const serviceHostname = svc.status.apply(
    (s) => s?.loadBalancer?.ingress?.[0]?.hostname ?? "pending...",
);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const vpcId = vpc.vpcId;
export const publicSubnetIds = vpc.publicSubnetIds;
export const privateSubnetIds = vpc.privateSubnetIds;
export const ecrRepositoryUrl = repo.repositoryUrl;
export const imageRef = image.ref;
export const kubeconfig = pulumi.secret(cluster.kubeconfig);
export const clusterEndpoint = cluster.core.endpoint;
export const clusterNameOutput = cluster.core.cluster.name;
export const appUrl = pulumi.interpolate`http://${serviceHostname}:9000`;
