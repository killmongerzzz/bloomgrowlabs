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

dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
)

table = dynamodb.Table('BloomGrow_IconCache')
ad_copy_table = dynamodb.Table('BloomGrow_AdCopy')

def cleanup_zero_byte_objects():
    print(f"Scanning S3 Bucket '{BUCKET}' for 0-byte objects...")
    
    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=BUCKET)
    
    zero_byte_keys = []
    
    for page in pages:
        if 'Contents' in page:
            for obj in page['Contents']:
                if obj['Size'] == 0:
                    zero_byte_keys.append(obj['Key'])
                    
    print(f"Found {len(zero_byte_keys)} 0-byte objects in S3.")
    
    if not zero_byte_keys:
        return
        
    # Delete from S3
    for key in zero_byte_keys:
        print(f"Deleting from S3: {key}")
        s3.delete_object(Bucket=BUCKET, Key=key)
        
    print("S3 cleanup complete.")
    
    print("Scanning DynamoDB to remove corresponding cache entries...")
    
    # Needs to scan DynamoDB and check if icon_url contains the S3 key
    response = table.scan()
    items = response.get('Items', [])
    
    dynamo_deleted = 0
    with table.batch_writer() as batch:
        for item in items:
            url = item.get('icon_url', '')
            for key in zero_byte_keys:
                if key in url:
                    print(f"Deleting from DynamoDB cache: {item['headline_hash']} for key {key}")
                    batch.delete_item(
                        Key={
                            'headline_hash': item['headline_hash']
                        }
                    )
                    dynamo_deleted += 1
                    break
                    
    # Pagination for DynamoDB
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items = response['Items']
        with table.batch_writer() as batch:
            for item in items:
                url = item.get('icon_url', '')
                for key in zero_byte_keys:
                    if key in url:
                        batch.delete_item(
                            Key={
                                'headline_hash': item['headline_hash']
                            }
                        )
                        dynamo_deleted += 1
                        break
                        
    print(f"DynamoDB cleanup complete. Deleted {dynamo_deleted} cache entries.")
    
    print("Scanning AdCopy table to remove stale icon references...")
    response = ad_copy_table.scan()
    items = response.get('Items', [])
    ad_copy_updated = 0
    
    for item in items:
        genome = item.get('genome', {})
        icon_url = genome.get('icon', '')
        for key in zero_byte_keys:
            if key in icon_url:
                print(f"Resetting stale icon in AdCopy: {item['id']}")
                genome['icon'] = 'none'
                ad_copy_table.update_item(
                    Key={'id': item['id']},
                    UpdateExpression="SET genome = :g",
                    ExpressionAttributeValues={':g': genome}
                )
                ad_copy_updated += 1
                break
                
    print(f"AdCopy cleanup complete. Updated {ad_copy_updated} items.")

if __name__ == "__main__":
    cleanup_zero_byte_objects()
