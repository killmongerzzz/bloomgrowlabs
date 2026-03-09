import boto3
import os
from dotenv import load_dotenv
import botocore

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

icon_cache_table = dynamodb.Table('BloomGrow_IconCache')
ad_copy_table = dynamodb.Table('BloomGrow_AdCopy')

def object_exists(key):
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == "404":
            return False
        raise

def cleanup_stale_references():
    print(f"Syncing DB with S3 Bucket '{BUCKET}'...")
    
    # 1. Clean IconCache
    print("Scanning IconCache table...")
    response = icon_cache_table.scan()
    items = response.get('Items', [])
    
    cache_deleted = 0
    for item in items:
        url = item.get('icon_url', '')
        if 'icons/' in url:
            key = 'icons/' + url.split('icons/')[1]
            if not object_exists(key):
                print(f"Stale Cache Entry Found (S3 404): {key}. Deleting...")
                icon_cache_table.delete_item(Key={'headline_hash': item['headline_hash']})
                cache_deleted += 1
                
    print(f"IconCache cleanup complete. Deleted {cache_deleted} entries.")

    # 2. Clean AdCopy
    print("Scanning AdCopy table...")
    response = ad_copy_table.scan()
    items = response.get('Items', [])
    
    ad_copy_updated = 0
    for item in items:
        genome = item.get('genome', {})
        icon_url = genome.get('icon', '')
        if 'icons/' in icon_url:
            key = 'icons/' + icon_url.split('icons/')[1]
            if not object_exists(key):
                print(f"Stale AdCopy reference (S3 404): {item['id']}. Resetting to 'none'...")
                genome['icon'] = 'none'
                ad_copy_table.update_item(
                    Key={'id': item['id']},
                    UpdateExpression="SET genome = :g",
                    ExpressionAttributeValues={':g': genome}
                )
                ad_copy_updated += 1
                
    print(f"AdCopy cleanup complete. Updated {ad_copy_updated} items.")

if __name__ == "__main__":
    cleanup_stale_references()
