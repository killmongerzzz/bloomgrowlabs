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

try:
    table = dynamodb.create_table(
        TableName='BloomGrow_IconCache',
        KeySchema=[
            {'AttributeName': 'headline_hash', 'KeyType': 'HASH'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'headline_hash', 'AttributeType': 'S'}
        ],
        BillingMode='PAY_PER_REQUEST'
    )
    table.wait_until_exists()
    print("Table BloomGrow_IconCache created successfully.")
except Exception as e:
    print("Error creating table (it might already exist):", e)
