---
name: aws-bedrock
description: >
  Amazon Bedrock — Converse API, model invocation (Claude / Llama / Nova /
  Mistral / Titan), Agents, Knowledge Bases, Guardrails, prompt caching,
  cross-region inference profiles, cost tracking. Trigger: bedrock-runtime,
  Converse, InvokeModel, BedrockAgent, retrieve_and_generate, guardrail,
  inference profile, model arn, embedding (Titan / Cohere), provisioned
  throughput.
origin: custom
---

# AWS Bedrock

Bedrock is the unified front door to multiple foundation models on AWS, with
IAM-based access, regional residency, VPC endpoints, and built-in CloudWatch /
CloudTrail. Reach for it when "we need the same model, but inside our AWS
boundary, billed on our AWS account" matters more than calling provider SDKs
directly.

## When to Activate

- Calling Claude / Nova / Llama / Mistral / Cohere through `bedrock-runtime`
- Building Bedrock Agents or Knowledge Bases (RAG with managed retrieval)
- Adding Bedrock Guardrails (PII, profanity, contextual filters)
- Embeddings via Titan / Cohere
- Comparing Bedrock vs direct provider SDKs (Anthropic, OpenAI)
- Provisioned throughput planning

## Bedrock vs Direct Provider SDKs

| Need | Pick |
|---|---|
| Stay inside one AWS account / billing / IAM | Bedrock |
| Latest Anthropic / OpenAI features same-day | Direct SDK |
| Data residency (EU/AP), VPC endpoints | Bedrock |
| PrivateLink, no public internet | Bedrock |
| Lowest absolute cost on a single model | Often direct SDK |
| Multi-model ensemble in one IAM boundary | Bedrock |

Bedrock typically lags the provider's own API by weeks for new features.
Confirm `Converse` supports a feature before designing around it.

## Converse API: The Default

`Converse` (and `ConverseStream`) is the unified, model-agnostic API. Prefer
it over `InvokeModel` — it normalises message structure, tool use, and
streaming across models.

```python
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")

response = client.converse(
    modelId="anthropic.claude-sonnet-4-6-20260101-v1:0",
    messages=[{"role": "user", "content": [{"text": "Summarise this PR"}]}],
    system=[{"text": "You are a senior reviewer. Be concise."}],
    inferenceConfig={"maxTokens": 1024, "temperature": 0.2},
)
text = response["output"]["message"]["content"][0]["text"]
```

```javascript
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });
const out = await client.send(new ConverseCommand({
  modelId: "anthropic.claude-sonnet-4-6-20260101-v1:0",
  messages: [{ role: "user", content: [{ text: "Summarise this PR" }] }],
  inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
}));
```

Use `ConverseStream` for token-by-token streaming. The event shape is the
same across providers — switching models is a `modelId` change, nothing else.

## Model IDs and Inference Profiles

Bedrock model IDs come in two flavours:

- **Foundation model ARN/ID** — `anthropic.claude-sonnet-4-6-20260101-v1:0`
  (region-bound; only callable in regions where the model is hosted).
- **Cross-region inference profile** — `us.anthropic.claude-sonnet-4-6-...`
  (`us.*`, `eu.*`, `apac.*`). Routes across AZs/regions for higher availability
  and throughput. **Default to inference profiles** in production unless data
  residency forbids it.

```python
# Cross-region profile — recommended default
modelId = "us.anthropic.claude-sonnet-4-6-20260101-v1:0"
```

Each region has different model availability — check `ListFoundationModels`
before assuming. The console page lies less than the docs.

## Tool Use (Function Calling)

```python
tools = [{
    "toolSpec": {
        "name": "get_order_status",
        "description": "Look up the status of a customer order by order ID.",
        "inputSchema": {"json": {
            "type": "object",
            "properties": {"order_id": {"type": "string"}},
            "required": ["order_id"],
        }},
    },
}]

response = client.converse(
    modelId=modelId,
    messages=messages,
    toolConfig={"tools": tools},
)

stop_reason = response["stopReason"]
if stop_reason == "tool_use":
    for block in response["output"]["message"]["content"]:
        if "toolUse" in block:
            tool_use = block["toolUse"]
            result = run_local(tool_use["name"], tool_use["input"])
            messages.append(response["output"]["message"])
            messages.append({"role": "user", "content": [{
                "toolResult": {
                    "toolUseId": tool_use["toolUseId"],
                    "content": [{"json": result}],
                }
            }]})
            # call converse again with updated messages
```

Tool schemas are JSON Schema. Keep them tight — the model uses the description
as much as the schema; ambiguous descriptions cause hallucinated args.

## Prompt Caching

For Claude on Bedrock, cache stable prefixes (system prompt, large docs):

```python
response = client.converse(
    modelId=modelId,
    system=[
        {"text": LARGE_SYSTEM_PROMPT, "cachePoint": {"type": "default"}},
    ],
    messages=messages,
)
```

Cache hits are 10% of input cost; misses cost a 25% premium. Worth it for any
prompt > ~2k tokens that gets reused.

## Knowledge Bases (Managed RAG)

Bedrock Knowledge Bases handle ingestion → chunking → embedding → vector
storage → retrieval → grounded generation in one managed flow.

```python
agent_runtime = boto3.client("bedrock-agent-runtime")

response = agent_runtime.retrieve_and_generate(
    input={"text": "What is our refund policy?"},
    retrieveAndGenerateConfiguration={
        "type": "KNOWLEDGE_BASE",
        "knowledgeBaseConfiguration": {
            "knowledgeBaseId": "ABCDEFGHIJ",
            "modelArn": "anthropic.claude-sonnet-4-6-20260101-v1:0",
        },
    },
)
```

When to use it: fast prototype, OpenSearch Serverless / Aurora pgvector backed,
no infra to babysit. When NOT: when you need custom chunking strategies or
hybrid retrieval — roll your own with `Retrieve` + `Converse`.

## Guardrails

Pre/post filters for PII, profanity, denied topics, contextual grounding,
prompt injection detection.

```python
response = client.converse(
    modelId=modelId,
    messages=messages,
    guardrailConfig={
        "guardrailIdentifier": "abc123",
        "guardrailVersion": "1",
        "trace": "enabled",
    },
)
```

Guardrails are model-agnostic — same guardrail works across Claude / Llama /
Nova. The contextual grounding filter (RAG hallucination check) is the most
useful one in practice.

## Embeddings

```python
response = client.invoke_model(
    modelId="amazon.titan-embed-text-v2:0",
    body=json.dumps({"inputText": text, "dimensions": 1024, "normalize": True}),
)
vec = json.loads(response["body"].read())["embedding"]
```

- **Titan Text Embeddings v2** — 1024/512/256 dim, multilingual, cheap default.
- **Cohere Embed v3** — better retrieval quality on English, supports
  `input_type` (`search_query` vs `search_document`).

Use `InvokeModel` for embeddings — Converse is text-generation only.

## Pricing Discipline

- **On-demand** for spiky / experimental workloads.
- **Provisioned Throughput** only when you've measured a steady RPS that
  justifies the hourly commit (math: monthly commit / on-demand cost at that
  RPS). Most teams overprovision.
- **Batch inference** for non-interactive jobs — 50% cheaper than on-demand,
  hours-scale latency.
- Tag `bedrock-runtime` invocations via the `applicationId` field in
  `requestMetadata` (CloudTrail) to attribute spend per feature.
- CloudWatch metrics: `Invocations`, `InputTokenCount`, `OutputTokenCount`,
  `InvocationThrottles`. Alarm on throttles before they bite.

## Networking

- **VPC interface endpoint** (`com.amazonaws.<region>.bedrock-runtime`) for
  workloads in private subnets. Avoids NAT egress, keeps traffic inside AWS.
- **PrivateLink** with same endpoint name — no public DNS resolution required.
- KMS-encrypted requests via custom CMK if compliance requires customer-managed
  keys for prompts/responses at rest in CloudWatch.

## Bedrock Agents

Use Agents when you want managed orchestration: action groups (Lambda-backed
tools), session memory, and trace UI. Skip them when:
- You need fine-grained control over the loop (custom retry, custom routing)
- You're already using a framework (LangGraph, custom harness)
- You want portable code (Agents are AWS-locked)

## Common Pitfalls

- **Region mismatch** — model not available, throws `AccessDeniedException`
  with a misleading message. Always check `ListFoundationModels` for the region.
- **Old model IDs** — IDs change with model versions. Pin via inference profile
  ARN, not bare model ID, to absorb minor version bumps.
- **Streaming + tool use** — partial JSON in tool args; buffer the full
  `toolUse` block before parsing.
- **Throttling** — default quotas are low. Request limit increases for any
  production workload before launch.
- **PII in CloudWatch logs** — Bedrock can log requests/responses. Disable
  model invocation logging in compliance environments, or route through
  KMS-encrypted destination only.

## Related

- `[skills/aws-cloud]` — IAM, VPC endpoints, CloudWatch
- `[skills/claude-api]` — when to call Anthropic directly instead
- `[skills/cost-aware-llm-pipeline]` — caching, batching, model routing
