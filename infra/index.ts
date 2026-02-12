import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const config = new pulumi.Config();
const appName = "hello-server";
const containerPort = 9000;
const cpu = config.getNumber("cpu") || 256;
const memory = config.getNumber("memory") || 512;
const desiredCount = config.getNumber("desiredCount") || 2;
const appVersion = config.get("appVersion") || "0.1.2";

// ---------------------------------------------------------------------------
// VPC – public + private subnets across 2 AZs
// ---------------------------------------------------------------------------
const vpc = new awsx.ec2.Vpc(`${appName}-vpc`, {
    numberOfAvailabilityZones: 2,
    natGateways: { strategy: awsx.ec2.NatGatewayStrategy.Single },
    tags: { Name: `${appName}-vpc` },
});

// ---------------------------------------------------------------------------
// ECR Repository – hosts the Docker image
// ---------------------------------------------------------------------------
const repo = new awsx.ecr.Repository(`${appName}-repo`, {
    forceDelete: true,
});

// Build and push the Docker image to ECR
const image = new awsx.ecr.Image(`${appName}-image`, {
    repositoryUrl: repo.url,
    context: "../hello-server",
    dockerfile: "../hello-server/Dockerfile",
    platform: "linux/amd64",
});

// ---------------------------------------------------------------------------
// ECS Cluster
// ---------------------------------------------------------------------------
const cluster = new aws.ecs.Cluster(`${appName}-cluster`, {
    settings: [
        {
            name: "containerInsights",
            value: "enabled",
        },
    ],
    tags: { Name: `${appName}-cluster` },
});

// ---------------------------------------------------------------------------
// Security Groups
// ---------------------------------------------------------------------------

// ALB Security Group – allow inbound HTTP (port 80) from the internet
const albSg = new aws.ec2.SecurityGroup(`${appName}-alb-sg`, {
    vpcId: vpc.vpcId,
    description: "Allow HTTP inbound to ALB",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow HTTP from anywhere",
        },
    ],
    egress: [
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow all outbound",
        },
    ],
    tags: { Name: `${appName}-alb-sg` },
});

// ECS Tasks Security Group – only allow traffic from the ALB
const ecsSg = new aws.ec2.SecurityGroup(`${appName}-ecs-sg`, {
    vpcId: vpc.vpcId,
    description: "Allow traffic from ALB to ECS tasks",
    ingress: [
        {
            protocol: "tcp",
            fromPort: containerPort,
            toPort: containerPort,
            securityGroups: [albSg.id],
            description: "Allow traffic from ALB",
        },
    ],
    egress: [
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow all outbound (pull images, etc.)",
        },
    ],
    tags: { Name: `${appName}-ecs-sg` },
});

// ---------------------------------------------------------------------------
// Application Load Balancer
// ---------------------------------------------------------------------------
const alb = new aws.lb.LoadBalancer(`${appName}-alb`, {
    internal: false,
    loadBalancerType: "application",
    securityGroups: [albSg.id],
    subnets: vpc.publicSubnetIds,
    tags: { Name: `${appName}-alb` },
});

const targetGroup = new aws.lb.TargetGroup(`${appName}-tg`, {
    port: containerPort,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: vpc.vpcId,
    healthCheck: {
        enabled: true,
        path: "/",
        port: "traffic-port",
        protocol: "HTTP",
        healthyThreshold: 3,
        unhealthyThreshold: 3,
        timeout: 5,
        interval: 30,
        matcher: "200",
    },
    tags: { Name: `${appName}-tg` },
});

const listener = new aws.lb.Listener(`${appName}-listener`, {
    loadBalancerArn: alb.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [
        {
            type: "forward",
            targetGroupArn: targetGroup.arn,
        },
    ],
});

// ---------------------------------------------------------------------------
// IAM Roles for ECS
// ---------------------------------------------------------------------------

// Task Execution Role – allows ECS to pull images & write logs
const executionRole = new aws.iam.Role(`${appName}-exec-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: { Service: "ecs-tasks.amazonaws.com" },
                Action: "sts:AssumeRole",
            },
        ],
    }),
    tags: { Name: `${appName}-exec-role` },
});

new aws.iam.RolePolicyAttachment(`${appName}-exec-policy`, {
    role: executionRole.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

// Task Role – the role the running container assumes
const taskRole = new aws.iam.Role(`${appName}-task-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: { Service: "ecs-tasks.amazonaws.com" },
                Action: "sts:AssumeRole",
            },
        ],
    }),
    tags: { Name: `${appName}-task-role` },
});

// ---------------------------------------------------------------------------
// CloudWatch Log Group
// ---------------------------------------------------------------------------
const logGroup = new aws.cloudwatch.LogGroup(`${appName}-logs`, {
    retentionInDays: 14,
    tags: { Name: `${appName}-logs` },
});

// ---------------------------------------------------------------------------
// ECS Task Definition
// ---------------------------------------------------------------------------
const taskDefinition = new aws.ecs.TaskDefinition(`${appName}-task`, {
    family: appName,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: cpu.toString(),
    memory: memory.toString(),
    executionRoleArn: executionRole.arn,
    taskRoleArn: taskRole.arn,
    containerDefinitions: pulumi
        .all([image.imageUri, logGroup.name])
        .apply(([imageUri, logGroupName]) =>
            JSON.stringify([
                {
                    name: appName,
                    image: imageUri,
                    essential: true,
                    portMappings: [
                        {
                            containerPort: containerPort,
                            hostPort: containerPort,
                            protocol: "tcp",
                        },
                    ],
                    logConfiguration: {
                        logDriver: "awslogs",
                        options: {
                            "awslogs-group": logGroupName,
                            "awslogs-region": aws.config.region || "us-east-1",
                            "awslogs-stream-prefix": "ecs",
                        },
                    },
                    healthCheck: {
                        command: [
                            "CMD-SHELL",
                            `wget --no-verbose --tries=1 --spider http://localhost:${containerPort}/ || exit 1`,
                        ],
                        interval: 30,
                        timeout: 5,
                        retries: 3,
                        startPeriod: 60,
                    },
                },
            ])
        ),
    tags: { Name: `${appName}-task` },
});

// ---------------------------------------------------------------------------
// ECS Fargate Service
// ---------------------------------------------------------------------------
const service = new aws.ecs.Service(`${appName}-svc`, {
    cluster: cluster.arn,
    taskDefinition: taskDefinition.arn,
    desiredCount: desiredCount,
    launchType: "FARGATE",
    networkConfiguration: {
        subnets: vpc.privateSubnetIds,
        securityGroups: [ecsSg.id],
        assignPublicIp: false,
    },
    loadBalancers: [
        {
            targetGroupArn: targetGroup.arn,
            containerName: appName,
            containerPort: containerPort,
        },
    ],
    deploymentCircuitBreaker: {
        enable: true,
        rollback: true,
    },
    tags: { Name: `${appName}-svc` },
}, { dependsOn: [listener] });

// ---------------------------------------------------------------------------
// Auto Scaling
// ---------------------------------------------------------------------------
const scalingTarget = new aws.appautoscaling.Target(`${appName}-scaling-target`, {
    maxCapacity: 4,
    minCapacity: desiredCount,
    resourceId: pulumi.interpolate`service/${cluster.name}/${service.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
});

// CPU-based auto scaling
new aws.appautoscaling.Policy(`${appName}-cpu-scaling`, {
    policyType: "TargetTrackingScaling",
    resourceId: scalingTarget.resourceId,
    scalableDimension: scalingTarget.scalableDimension,
    serviceNamespace: scalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
        predefinedMetricSpecification: {
            predefinedMetricType: "ECSServiceAverageCPUUtilization",
        },
        targetValue: 70.0,
        scaleInCooldown: 60,
        scaleOutCooldown: 60,
    },
});

// Memory-based auto scaling
new aws.appautoscaling.Policy(`${appName}-memory-scaling`, {
    policyType: "TargetTrackingScaling",
    resourceId: scalingTarget.resourceId,
    scalableDimension: scalingTarget.scalableDimension,
    serviceNamespace: scalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
        predefinedMetricSpecification: {
            predefinedMetricType: "ECSServiceAverageMemoryUtilization",
        },
        targetValue: 80.0,
        scaleInCooldown: 60,
        scaleOutCooldown: 60,
    },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const vpcId = vpc.vpcId;
export const clusterName = cluster.name;
export const serviceName = service.name;
export const albDnsName = alb.dnsName;
export const appUrl = pulumi.interpolate`http://${alb.dnsName}`;
export const ecrRepositoryUrl = repo.url;
export const taskDefinitionArn = taskDefinition.arn;
