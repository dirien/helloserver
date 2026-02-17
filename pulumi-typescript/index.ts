import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

// Get configuration from Pulumi config
const config = new pulumi.Config();

// Optional: Configure Kubernetes provider
// If not specified, uses current kubectl context
const k8sProvider = new k8s.Provider("k8s-provider", {
    // To use a specific kubeconfig file, uncomment and set:
    // kubeconfig: config.get("kubeconfig"),

    // To use a specific context from your kubeconfig:
    // context: config.get("kubeContext"),

    // For cloud-specific configuration, you can also specify:
    // cluster: config.get("clusterName"),
    // Or leave empty to use the default kubectl context
});

// Deploy the hello-server Helm chart
const helloServerChart = new k8s.helm.v3.Chart("hello-server", {
    // Path to the Helm chart (relative to this file)
    path: "../delivery/charts/hello-server",

    // Optional: Override values from values.yaml
    values: {
        replicaCount: config.getNumber("replicaCount") || 1,
        image: {
            repository: "dirien/hello-server",
            pullPolicy: "Always",
            tag: "v0.1.0",
        },
        service: {
            type: "ClusterIP",
            port: 9000,
        },
        // Optional: Enable ingress if needed
        ingress: {
            enabled: config.getBoolean("ingressEnabled") || false,
        },
    },

    // Optional: Specify namespace
    namespace: config.get("namespace") || "default",

}, { provider: k8sProvider });

// Export the service name and namespace
export const serviceName = helloServerChart.getResourceProperty(
    "v1/Service",
    "default/hello-server",
    "metadata"
).apply(metadata => metadata.name);

export const namespace = config.get("namespace") || "default";

// Export information about how to access the service
export const accessInfo = pulumi.interpolate`
To access the hello-server application:
1. Port-forward to the service:
   kubectl port-forward svc/hello-server 9000:9000 -n ${namespace}

2. Access the application at:
   http://localhost:9000
`;
