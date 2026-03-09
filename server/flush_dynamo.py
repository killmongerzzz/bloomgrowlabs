import boto3
import os
from dotenv import load_dotenv

load_dotenv()

dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
)

table = dynamodb.Table('BloomGrow_IconCache')

try:
    print("Scanning DynamoDB Icon Cache...")
    response = table.scan()
    items = response.get('Items', [])
    
    deleted = 0
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(
                Key={
                    'headline_hash': item['headline_hash']
                }
            )
            deleted += 1
            
    # Handle pagination if there are more items
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items = response['Items']
        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(
                    Key={
                        'headline_hash': item['headline_hash']
                    }
                )
                deleted += 1

    print(f"SUCCESS: Flushed {deleted} records from BloomGrow_IconCache.")
except Exception as e:
    print(f"Error flushing DynamoDB: {e}")
