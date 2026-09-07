# Hermes + OpenClaw SSR Function

This project demonstrates a Server-Side Rendering (SSR) function using Hermes JavaScript engine and OpenClaw (or OpenFaaS) for full-stack web applications.

## Project Structure

- `src/ssr-function/index.js`: The SSR function handler
- `package.json`: npm dependencies and scripts
- `Dockerfile`: Container image definition
- `ssr-function.yml`: OpenFaaS function manifest

## Local Testing

To test the function locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the function directly (if hermes-engine works):
   ```bash
   node src/ssr-function/index.js
   ```
   Note: This requires a working hermes-engine installation. If you encounter package errors, you may need to adjust the hermes-engine version or use an alternative JS engine for testing.

## Building Docker Image

```bash
docker build -t hermes-ssr:latest .
```

## Running the Container

```bash
docker run --rm -p 3000:3000 hermes-ssr:latest
```

## Deploying to OpenClaw / OpenFaaS

1. Deploy OpenFaaS (or your OpenClaw implementation) to Kubernetes:
   ```bash
   helm repo add openfaas https://openfaas.github.io/faas-netes/
   helm upgrade --install openfaas openfaas/openfaas \
       --namespace openfaas --create-namespace \
       --set functionNamespace=openfaas-fn
   ```

2. Deploy the function:
   ```bash
   faas-cli deploy -f ssr-function.yml --gateway http://<your-gateway>
   ```

3. Access the function via the gateway URL.

## Production Considerations

- Use distroless base image for smaller attack surface
- Configure autoscaling based on CPU/QPS
- Enable observability with OpenTelemetry
- Set up CI/CD pipeline with GitHub Actions and ArgoCD
- Implement canary deployments for zero-downtime updates

## References

- Hermes Engine: https://github.com/facebook/hermes
- OpenFaaS: https://github.com/openfaas/faas
- Kubernetes: https://kubernetes.io/

