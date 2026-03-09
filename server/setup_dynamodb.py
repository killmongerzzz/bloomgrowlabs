import boto3
import os
from dotenv import load_dotenv

# Load AWS credentials from .env
load_dotenv()

dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
)

def create_table(table_name, key_schema, attribute_definitions, global_secondary_indexes=None):
    try:
        print(f"Creating table {table_name}...")
        kwargs = {
            'TableName': table_name,
            'KeySchema': key_schema,
            'AttributeDefinitions': attribute_definitions,
            'BillingMode': 'PAY_PER_REQUEST'
        }
        if global_secondary_indexes:
            kwargs['GlobalSecondaryIndexes'] = global_secondary_indexes
            
        table = dynamodb.create_table(**kwargs)
        # Wait until the table exists.
        table.meta.client.get_waiter('table_exists').wait(TableName=table_name)
        print(f"Table {table_name} created successfully.")
    except Exception as e:
        print(f"Error creating {table_name} (might already exist): {e}")

def setup():
    # 1. BloomGrow_Campaigns
    create_table(
        table_name='BloomGrow_Campaigns',
        key_schema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        attribute_definitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
    )
    
    # 2. BloomGrow_PainPoints
    create_table(
        table_name='BloomGrow_PainPoints',
        key_schema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        attribute_definitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
    )
    
    # 3. BloomGrow_AdCopy (with GSIs for variant_group and status)
    create_table(
        table_name='BloomGrow_AdCopy',
        key_schema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        attribute_definitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'variant_group', 'AttributeType': 'S'},
            {'AttributeName': 'status', 'AttributeType': 'S'},
        ],
        global_secondary_indexes=[
            {
                'IndexName': 'variant_group-index',
                'KeySchema': [{'AttributeName': 'variant_group', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'}
            },
            {
                'IndexName': 'status-index',
                'KeySchema': [{'AttributeName': 'status', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ]
    )
    
    # 4. BloomGrow_AdPerformance (with GSI for campaign_id)
    create_table(
        table_name='BloomGrow_AdPerformance',
        key_schema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        attribute_definitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'campaign_id', 'AttributeType': 'S'}
        ],
        global_secondary_indexes=[
            {
                'IndexName': 'campaign_id-index',
                'KeySchema': [{'AttributeName': 'campaign_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ]
    )
    
    # 5. BloomGrow_Creatives
    create_table(
        table_name='BloomGrow_Creatives',
        key_schema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
        attribute_definitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'},
            {'AttributeName': 'copy_id', 'AttributeType': 'S'}
        ],
        global_secondary_indexes=[
            {
                'IndexName': 'copy_id-index',
                'KeySchema': [{'AttributeName': 'copy_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ]
    )

    print("All DynamoDB tables provisioned.")

if __name__ == "__main__":
    setup()
