import boto3
import os
from dotenv import load_dotenv

load_dotenv()
BUCKET = os.environ.get("AWS_S3_BUCKET", "bloomgrow-assets")

s3 = boto3.client(
    's3',
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
)

try:
    print(f"Emptying S3 Bucket: {BUCKET}...")
    
    # Needs paginated deletion for buckets with more than 1000 items
    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=BUCKET)
    
    deleted = 0
    for page in pages:
        if 'Contents' in page:
            for obj in page['Contents']:
                s3.delete_object(Bucket=BUCKET, Key=obj['Key'])
                deleted += 1
                
    print(f"SUCCESS: Flushed {deleted} objects from {BUCKET}.")
except Exception as e:
    print(f"Error flushing S3: {e}")
