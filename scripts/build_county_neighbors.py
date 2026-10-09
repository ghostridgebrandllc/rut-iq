"""Build nearby-county links from exact shared edges in Rut IQ's existing map geometry.
This is map-derived coverage, not a new survey or an exhaustive modern adjacency source.
"""
from collections import defaultdict
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
regions=json.loads((ROOT/'regions.json').read_text())
valid={c['fips'] for counties in regions.values() for c in counties}
edges=defaultdict(set)
neighbors={f:set() for f in valid}
for path in (ROOT/'maps').glob('*.json'):
    for feature in json.loads(path.read_text())['features']:
        props=feature['properties']
        fips=props['STATE']+props['COUNTY']
        if fips not in valid:
            continue
        geometry=feature['geometry']
        polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
        for polygon in polygons:
            for ring in polygon:
                for a,b in zip(ring,ring[1:]):
                    edge=tuple(sorted((tuple(a),tuple(b))))
                    if edge[0]!=edge[1]:
                        edges[edge].add(fips)
for counties in edges.values():
    for fips in counties:
        neighbors[fips].update(counties-{fips})
(ROOT/'county-neighbors.json').write_text(json.dumps({k:sorted(v) for k,v in sorted(neighbors.items())},separators=(',',':'))+'\n')
print('Counties with shared-edge coverage:',sum(bool(v) for v in neighbors.values()))
