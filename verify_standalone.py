
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import plotly.graph_objects as go
import plotly.express as px

# Minimal mockup of what we added to lazycook6.py
class PlotlyChartGenerator:
    def __init__(self, output_dir: str = "multi_agent_data/test_charts"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def extract_plot_configs(self, text: str) -> List[Dict]:
        import re
        configs = []
        pattern = r'<plot_config>\s*(\{[\s\S]*?\})\s*</plot_config>'
        matches = re.finditer(pattern, text)
        for match in matches:
            try:
                config_json = match.group(1)
                config = json.loads(config_json)
                configs.append(config)
            except json.JSONDecodeError:
                continue
        return configs
    
    def create_chart(self, config: Dict) -> Optional[go.Figure]:
        chart_type = config.get('type', 'bar').lower()
        if chart_type == 'bar': return self._create_bar_chart(config)
        if chart_type == 'heatmap': return self._create_heatmap(config)
        return self._create_bar_chart(config)
    
    def _create_bar_chart(self, config: Dict) -> go.Figure:
        title = config.get('title', 'Bar Chart')
        labels = config.get('labels', [])
        datasets = config.get('datasets', [])
        fig = go.Figure()
        for dataset in datasets:
            fig.add_trace(go.Bar(name=dataset.get('label', 'Data'), x=labels, y=dataset.get('data', [])))
        fig.update_layout(title=title)
        return fig
    
    def _create_heatmap(self, config: Dict) -> go.Figure:
        title = config.get('title', 'Heatmap')
        fig = go.Figure(data=go.Heatmap(z=config.get('z_values', []), x=config.get('x_labels', []), y=config.get('y_labels', [])))
        fig.update_layout(title=title)
        return fig
    
    def generate_charts(self, response_text: str) -> tuple:
        configs = self.extract_plot_configs(response_text)
        if not configs: return response_text, []
        chart_files = []
        for i, config in enumerate(configs):
            fig = self.create_chart(config)
            if fig:
                filename = f"test_chart_{i}.html"
                filepath = self.output_dir / filename
                fig.write_html(str(filepath))
                chart_files.append(str(filepath))
        return response_text, chart_files

# Test execution
def test():
    generator = PlotlyChartGenerator()
    test_text = """
    <plot_config>
    {"type": "bar", "title": "Test", "labels": ["A", "B"], "datasets": [{"label": "S1", "data": [1, 2]}]}
    </plot_config>
    """
    _, files = generator.generate_charts(test_text)
    print(f"Generated files: {files}")
    if files:
        print("✓ Standalone verification successful!")
    else:
        print("❌ Standalone verification failed!")

if __name__ == "__main__":
    test()
