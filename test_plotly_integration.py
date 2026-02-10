
import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime
import logging

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from lazycook6 import PlotlyChartGenerator, MultiAgentSystem

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_chart_generator():
    print("\n--- Testing PlotlyChartGenerator ---")
    generator = PlotlyChartGenerator(output_dir="multi_agent_data/test_charts")
    
    # 1. Test Bar Chart Config
    bar_config = {
        "type": "bar",
        "title": "Test Bar Chart",
        "xaxis_title": "Month",
        "yaxis_title": "Sales",
        "data": {
            "labels": ["Jan", "Feb", "Mar"],
            "datasets": [{"label": "Revenue", "values": [100, 150, 120]}]
        }
    }
    
    # 2. Test Heatmap Config
    heatmap_config = {
        "type": "heatmap",
        "title": "Test Heatmap",
        "xaxis_title": "Time",
        "yaxis_title": "Day",
        "z_values": [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        "x_labels": ["Morning", "Afternoon", "Evening"],
        "y_labels": ["Mon", "Tue", "Wed"]
    }
    
    # 3. Test extraction and generation
    response_text = f"""
    Here is a bar chart:
    <plot_config>
    {json.dumps(bar_config)}
    </plot_config>
    
    And here is a heatmap:
    <plot_config>
    {json.dumps(heatmap_config)}
    </plot_config>
    """
    
    cleaned_text, chart_files = generator.generate_charts(response_text)
    
    print(f"Cleaned text length: {len(cleaned_text)}")
    print(f"Generated chart files: {chart_files}")
    
    assert len(chart_files) == 2
    assert "<plot_config>" not in cleaned_text
    print("✓ PlotlyChartGenerator basic test passed!")
    return chart_files

async def main():
    try:
        chart_files = await test_chart_generator()
        
        print("\n--- All Tests Passed! ---")
        print(f"You can find the test charts in: {os.path.abspath('multi_agent_data/test_charts')}")
        for chart in chart_files:
            print(f"- {chart}")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
