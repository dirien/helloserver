import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const config = new pulumi.Config();
const clusterName = config.get("clusterName") || "hello-server-eks";
const instanceType = config.get("instanceType") || "t3.medium";
const desiredCapacity = config.getNumber("desiredCapacity") || 2;
const minSize = config.getNumber("minSize") || 1;
const maxSize = config.getNumber("maxSize") || 3;
const appReplicas = config.getNumber("appReplicas") || 2;

const stackName = pulumi.getStack();

const tags: Record<string, string> = {
    Environment: stackName,
    ManagedBy: "Pulumi",
    Project: "hello-server",
};

// ---------------------------------------------------------------------------
// 1. Networking — VPC with public & private subnets across 2 AZs
// ---------------------------------------------------------------------------
const vpc = new awsx.ec2.Vpc("hello-server-vpc", {
    cidrBlock: "10.0.0.0/16",
    numberOfAvailabilityZones: 2,
    subnetStrategy: awsx.ec2.SubnetAllocationStrategy.Auto,
    subnetSpecs: [
        { type: awsx.ec2.SubnetType.Public, cidrMask: 22 },
        { type: awsx.ec2.SubnetType.Private, cidrMask: 20 },
    ],
    enableDnsHostnames: true,
    enableDnsSupport: true,
    natGateways: { strategy: awsx.ec2.NatGatewayStrategy.Single },
    tags,
});

// ---------------------------------------------------------------------------
// 2. EKS Cluster
// ---------------------------------------------------------------------------
const cluster = new eks.Cluster(clusterName, {
    vpcId: vpc.vpcId,
    publicSubnetIds: vpc.publicSubnetIds,
    privateSubnetIds: vpc.privateSubnetIds,
    instanceType: instanceType,
    desiredCapacity: desiredCapacity,
    minSize: minSize,
    maxSize: maxSize,
    nodeRootVolumeSize: 20,
    endpointPublicAccess: true,
    endpointPrivateAccess: true,
    createOidcProvider: true,
    tags,
});

// ---------------------------------------------------------------------------
// 3. Kubernetes provider scoped to the new EKS cluster
// ---------------------------------------------------------------------------
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: cluster.kubeconfigJson,
});

// ---------------------------------------------------------------------------
// 4. Create a dedicated namespace for the application
// ---------------------------------------------------------------------------
const appNamespace = new k8s.core.v1.Namespace(
    "hello-server-ns",
    {
        metadata: {
            name: "hello-server",
            labels: {
                app: "hello-server",
                ...tags,
            },
        },
    },
    { provider: k8sProvider },
);

// ---------------------------------------------------------------------------
// 5. Deploy the Hello Server using the existing Helm chart
// ---------------------------------------------------------------------------
const helmRelease = new k8s.helm.v3.Release(
    "hello-server",
    {
        chart: "../delivery/charts/hello-server",
        namespace: appNamespace.metadata.name,
        values: {
            replicaCount: appReplicas,
            image: {
                repository: "dirien/hello-server",
                tag: "v0.1.2",
                pullPolicy: "IfNotPresent",
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
    { provider: k8sProvider, dependsOn: [appNamespace] },
);

// ---------------------------------------------------------------------------
// 6. Look up the LoadBalancer hostname once the service is live
// ---------------------------------------------------------------------------
const appService = k8s.core.v1.Service.get(
    "hello-server-svc",
    pulumi.interpolate`${appNamespace.metadata.name}/hello-server`,
    { provider: k8sProvider, dependsOn: [helmRelease] },
);

const appUrl = appService.status.apply((s) => {
    const ingress = s?.loadBalancer?.ingress?.[0];
    if (ingress?.hostname) return `http://${ingress.hostname}:9000`;
    if (ingress?.ip) return `http://${ingress.ip}:9000`;
    return "pending...";
});

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
export const vpcId = vpc.vpcId;
export const publicSubnetIds = vpc.publicSubnetIds;
export const privateSubnetIds = vpc.privateSubnetIds;
export const clusterNameOutput = cluster.eksCluster.name;
export const clusterEndpoint = cluster.eksCluster.endpoint;
export const kubeconfig = pulumi.secret(cluster.kubeconfig);
export const oidcProviderArn = cluster.oidcProviderArn;
export const applicationUrl = appUrl;
export const namespaceName = appNamespace.metadata.name;
