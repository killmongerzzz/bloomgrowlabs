import boto3
import os
from dotenv import load_dotenv

load_dotenv()

s3 = boto3.client(
    's3',
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
)

buckets_to_try = [
    os.environ.get("AWS_S3_BUCKET", "bloomgrow-assets"),
    "bloomgrow-assets-12345",
    "bloomgrow-svg-assets",
    "bloomgrow-ai-creatives"
]

created = False
for b in buckets_to_try:
    print(f"Trying to create bucket: {b}")
    try:
        # us-east-1 doesn't require LocationConstraint
        region = os.environ.get('AWS_REGION', 'us-east-1')
        if region == 'us-east-1':
            s3.create_bucket(Bucket=b)
        else:
            s3.create_bucket(
                Bucket=b,
                CreateBucketConfiguration={'LocationConstraint': region}
            )
        
        # Turn off block public access so we can serve images
        s3.put_public_access_block(
            Bucket=b,
            PublicAccessBlockConfiguration={
                'BlockPublicAcls': False,
                'IgnorePublicAcls': False,
                'BlockPublicPolicy': False,
                'RestrictPublicBuckets': False
            }
        )
        
        print(f"SUCCESS! Bucket {b} created and configured for public access.")
        
        # Write back to .env to update the bucket name
        with open(".env", "a") as f:
            f.write(f"\nAWS_S3_BUCKET={b}\n")
            
        created = True
        break
    except Exception as e:
        print(f"Failed to create {b}: {e}")

if not created:
    print("Could not create any buckets.")
