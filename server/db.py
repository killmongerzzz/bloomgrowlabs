import boto3
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize the DynamoDB resource using the specific BloomGrow keys
def get_dynamodb_resource():
    return boto3.resource(
        'dynamodb',
        region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.environ.get('AWS_BLOOMGROW_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_BLOOMGROW_SECRET_ACCESS_KEY')
    )

dynamodb = get_dynamodb_resource()

# Table References
campaigns_table = dynamodb.Table('BloomGrow_Campaigns')
pain_points_table = dynamodb.Table('BloomGrow_PainPoints')
ad_copy_table = dynamodb.Table('BloomGrow_AdCopy')
ad_performance_table = dynamodb.Table('BloomGrow_AdPerformance')
creatives_table = dynamodb.Table('BloomGrow_Creatives')
branding_table = dynamodb.Table('BloomGrow_Branding')
competitor_ads_table = dynamodb.Table('BloomGrow_CompetitorAds')
icon_cache_table = dynamodb.Table('BloomGrow_IconCache')
