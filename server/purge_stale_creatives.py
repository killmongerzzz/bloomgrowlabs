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

ad_copy_table = dynamodb.Table('BloomGrow_AdCopy')

stale_keys = [
    'icons/0c4bfde6-201e-4aa7-aa0e-56a4498dc2af.svg',
    'icons/5fd3e484-6af7-4cd2-81b9-a70637db47b9.svg',
    'icons/79959d74-c182-491f-a622-d76c6ec493ab.svg',
    'icons/7be49b79-0086-4b81-a001-0c4b00630773.svg',
    'icons/b3ad30e5-0fd5-4193-9104-4672c48494c3.svg',
    'icons/d5f7e524-3c97-4a25-9657-eb2a6d3bdb2a.svg',
    'icons/f87c07e4-0ae4-4788-a916-77d916aa5217.svg'
]

def purge_stale_adcopy():
    print("Purging stale icon references from BloomGrow_AdCopy...")
    res = ad_copy_table.scan()
    items = res.get('Items', [])
    updated = 0
    
    for item in items:
        genome = item.get('genome', {})
        icon = genome.get('icon', '')
        if any(sk in icon for sk in stale_keys):
            print(f"Purging icon for item: {item['id']}")
            genome['icon'] = 'none'
            ad_copy_table.update_item(
                Key={'id': item['id']},
                UpdateExpression="SET genome = :g",
                ExpressionAttributeValues={':g': genome}
            )
            updated += 1
            
    print(f"Finished. Updated {updated} items.")

if __name__ == "__main__":
    purge_stale_adcopy()
