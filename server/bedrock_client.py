"""
Bedrock Client — Claude Haiku via AWS Bedrock
-----------------------------------------------
Used for on-demand AI explanations of Marketing Brain audit findings.
Only called when a user explicitly clicks "Explain with AI" on a finding.
Cost-optimised: uses Claude 3 Haiku (cheapest / fastest Anthropic model).
"""

import os
import json
import boto3
from dotenv import load_dotenv

load_dotenv()

# Read AWS credentials from environment
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# Claude 3 Haiku via Bedrock (cheapest, fastest)
CLAUDE_HAIKU_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"


def get_bedrock_client():
    """Create a boto3 Bedrock runtime client using .env credentials."""
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        raise ValueError("AWS credentials not configured in .env")
    
    return boto3.client(
        service_name="bedrock-runtime",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def explain_finding_with_claude(
    issue_type: str,
    description: str,
    recommendation: str,
    check_id: str,
    severity: str,
) -> dict:
    """
    Calls Claude 3 Haiku via Bedrock to generate a detailed, actionable
    explanation of a specific Marketing Brain audit finding.
    
    Returns a plain-English explanation with context and step-by-step
    guidance on how to fix the issue.
    """
    prompt = f"""You are an expert digital advertising consultant specialized in Meta Ads, Google Ads, and performance marketing.

A marketing audit has flagged the following issue for a direct-to-consumer app company:

**Audit Check:** {check_id} — {issue_type}
**Severity:** {severity}
**What was detected:** {description}
**Initial recommendation:** {recommendation}

Please provide a detailed, actionable explanation in this structure:

1. **Why this matters** (2-3 sentences explaining the business impact)
2. **Root causes** (list 2-3 common reasons this happens)
3. **Step-by-step fix** (3-5 concrete actions to resolve it)
4. **Expected outcome** (what improvement to expect after fixing)

Keep it concise, practical, and written for a growth marketer. No filler text."""

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 600,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    try:
        client = get_bedrock_client()
        response = client.invoke_model(
            modelId=CLAUDE_HAIKU_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        result = json.loads(response["body"].read())
        explanation = result["content"][0]["text"]
        
        return {
            "status": "success",
            "check_id": check_id,
            "explanation": explanation,
            "model": "claude-3-haiku (bedrock)",
        }
    
    except Exception as e:
        print(f"[bedrock] Error calling Claude: {e}")
        return {
            "status": "error",
            "message": str(e),
        }


if __name__ == "__main__":
    # Quick test
    result = explain_finding_with_claude(
        issue_type="Low CTR",
        description="Campaign has avg CTR of 0.4% (threshold: 0.8%)",
        recommendation="Review ad copy angles and test question-based headlines.",
        check_id="BC-101",
        severity="High",
    )
    print(json.dumps(result, indent=2))
