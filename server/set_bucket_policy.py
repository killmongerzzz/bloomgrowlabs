import boto3
import os
import json
from dotenv import load_dotenv

load_dotenv()

s3 = boto3.client(
    's3',
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
)

BUCKET = os.environ.get("AWS_S3_BUCKET", "bloomgrow-assets")

policy = {
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "PublicReadGetObject",
        "Effect": "Allow",
        "Principal": "*",
        "Action": ["s3:GetObject"],
        "Resource": [f"arn:aws:s3:::{BUCKET}/*"]
    }]
}

try:
    s3.put_bucket_policy(Bucket=BUCKET, Policy=json.dumps(policy))
    print("SUCCESS: Attached public-read bucket policy.")
except Exception as e:
    print(f"FAILED: {e}")
