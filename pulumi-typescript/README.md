# Hello Server - Pulumi TypeScript Deployment

This Pulumi TypeScript project deploys the hello-server application to Kubernetes using the Helm chart located at `../delivery/charts/hello-server/`.

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed
- [Node.js](https://nodejs.org/) (v18 or later)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) configured with access to a Kubernetes cluster
- A Kubernetes cluster (local like minikube/kind, or cloud-based like EKS/GKE/AKS)

## Project Structure

```
pulumi-typescript/
├── Pulumi.yaml           # Pulumi project definition
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
├── index.ts              # Main Pulumi program (deploys Helm chart)
├── .gitignore            # Git ignore file
└── README.md             # This file
```

## Quick Start

### 1. Install Dependencies

```bash
cd pulumi-typescript
npm install
```

### 2. Configure Kubernetes Context

Ensure your kubectl is configured to point to the desired cluster:

```bash
kubectl config current-context
kubectl get nodes
```

### 3. Initialize Pulumi Stack

```bash
# Login to Pulumi (local backend or Pulumi Cloud)
pulumi login

# Or use local backend
pulumi login file://~/.pulumi

# Create a new stack (e.g., dev, staging, prod)
pulumi stack init dev
```

### 4. Configure the Stack (Optional)

You can customize the deployment using Pulumi configuration:

```bash
# Set custom namespace (default: default)
pulumi config set namespace hello-server

# Set replica count (default: 1)
pulumi config set replicaCount 2

# Enable ingress (default: false)
pulumi config set ingressEnabled true

# Use specific kubeconfig file
pulumi config set kubeconfig ~/.kube/my-config

# Use specific context from kubeconfig
pulumi config set kubeContext my-cluster-context
```

### 5. Preview and Deploy

```bash
# Preview the changes
pulumi preview

# Deploy the application
pulumi up
```

### 6. Access the Application

After deployment, the hello-server application runs as a ClusterIP service on port 9000. To access it:

```bash
# Port-forward to the service
kubectl port-forward svc/hello-server 9000:9000 -n default

# Access the application
curl http://localhost:9000
```

Or in your browser:
```
http://localhost:9000
```

## Configuration Options

The project supports the following configuration options:

| Config Key | Description | Default |
|------------|-------------|---------|
| `namespace` | Kubernetes namespace for deployment | `default` |
| `replicaCount` | Number of pod replicas | `1` |
| `ingressEnabled` | Enable ingress for external access | `false` |
| `kubeconfig` | Path to kubeconfig file | Current kubectl context |
| `kubeContext` | Kubernetes context to use | Current kubectl context |

## Using Pulumi ESC (Recommended)

Instead of using `pulumi config set`, you can use Pulumi ESC for centralized configuration:

```bash
# Create an ESC environment
pulumi env init myorg/hello-server-dev

# Link it to your stack
pulumi config env add myorg/hello-server-dev

# Run with ESC environment
pulumi env run myorg/hello-server-dev -- pulumi up
```

## Application Details

- **Application**: hello-server (Go web application)
- **Image**: `dirien/hello-server:v0.1.0`
- **Port**: 9000
- **Service Type**: ClusterIP
- **Helm Chart**: `../delivery/charts/hello-server/`

## Useful Commands

```bash
# View stack outputs
pulumi stack output

# View deployed resources
pulumi stack

# Update the deployment
pulumi up

# Destroy the deployment
pulumi destroy

# View deployment logs
kubectl logs -l app.kubernetes.io/name=hello-server -n default

# Check service status
kubectl get svc hello-server -n default
```

## Customizing Values

The `index.ts` file allows you to override Helm chart values. You can modify the `values` object in the Chart resource:

```typescript
values: {
    replicaCount: 2,
    image: {
        repository: "dirien/hello-server",
        tag: "v0.2.0",
    },
    service: {
        type: "LoadBalancer",  // Change to LoadBalancer for external access
        port: 9000,
    },
    ingress: {
        enabled: true,
        hosts: [
            {
                host: "hello-server.example.com",
            }
        ],
    },
}
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n default
kubectl describe pod <pod-name> -n default
```

### View Pod Logs
```bash
kubectl logs -l app.kubernetes.io/name=hello-server -n default -f
```

### Check Service
```bash
kubectl get svc hello-server -n default
kubectl describe svc hello-server -n default
```

### Pulumi State Issues
```bash
# Refresh Pulumi state
pulumi refresh

# Export stack
pulumi stack export > stack.json
```

## Best Practices

1. **Use Pulumi ESC** for secrets and configuration management
2. **Enable RBAC** and proper security contexts in production
3. **Use separate stacks** for different environments (dev, staging, prod)
4. **Tag resources** appropriately for cost tracking and management
5. **Review changes** with `pulumi preview` before applying
6. **Version control** your infrastructure code

## References

- [Pulumi Kubernetes Provider](https://www.pulumi.com/registry/packages/kubernetes/)
- [Pulumi TypeScript SDK](https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/pulumi/)
- [Helm Charts with Pulumi](https://www.pulumi.com/registry/packages/kubernetes/api-docs/helm/v3/chart/)
- [Pulumi ESC Documentation](https://www.pulumi.com/docs/pulumi-cloud/esc/)
