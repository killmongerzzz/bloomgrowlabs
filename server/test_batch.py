from creative_agent import generate_creative_batch

mock_brand = {
    "audience": "Millennial parents",
    "tone": "Calm",
    "comm_style": "Balanced",
    "design_dir": "Calm Minimal",
    "visual_focus": "Nature"
}

print("Running batch generation...")
creatives = generate_creative_batch(
    copy_id="test_id_123",
    original_headline="Is your toddler waking up at 3AM?",
    original_description="Discover gentle ways to improve sleep.",
    tone="Empathetic",
    brand_id=mock_brand,
    count=25
)

print(f"Goal: 25. Actual Generated: {len(creatives)}")
