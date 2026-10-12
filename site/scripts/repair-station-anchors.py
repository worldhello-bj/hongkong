#!/usr/bin/env python3
"""Two source-backed station endpoint corrections. Never adds/relaxes graph edges.
Usage: python repair-station-anchors.py SITE_ROOT [--apply]
Without --apply, verifies and prints proposed coverage changes without writing.
"""
import argparse,collections,copy,gzip,hashlib,json,math,pathlib
p=argparse.ArgumentParser();p.add_argument('root',type=pathlib.Path);p.add_argument('--apply',action='store_true');a=p.parse_args();root=a.root
path=root/'dist/area/station-graph.json.gz';g=json.load(gzip.open(path));before=copy.deepcopy(g);nodes={n['id']:n for n in g['nodes']}
def reach(start,edges,reverse=False):
 adj=collections.defaultdict(list)
 for e in edges:adj[e['to_id'] if reverse else e['from_id']].append(e['from_id'] if reverse else e['to_id'])
 seen={start};todo=[start]
 for n in todo:
  for nxt in adj[n]:
   if nxt not in seen:seen.add(nxt);todo.append(nxt)
 return seen
def ring(pt,r):
 x,y=pt[:2];inside=False
 for aa,bb in zip(r,r[1:]+r[:1]):
  if (aa[1]>y)!=(bb[1]>y) and x<(bb[0]-aa[0])*(y-aa[1])/(bb[1]-aa[1])+aa[0]:inside=not inside
 return inside
def contains(pt,f):
 rings=f['geometry']['coordinates'];return ring(pt,rings[0]) and not any(ring(pt,r) for r in rings[1:])
source='https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map'
# Source-backed lift endpoint. This is a distinct entrance, never a replacement for the stairs.
huh=nodes['HUH:N:1883cb44eadc07']
evidence_path=root/'src/station-evidence/huh-b2-lift.json'
source_evidence=json.load(open(evidence_path))
assert source_evidence['feature']['id']=='mtr_amenity_point.2654'
assert source_evidence['feature']['properties']['amenity_category']=='elevator'
source_c=source_evidence['feature']['geometry']['coordinates']
unit=next(f for f in json.load(open(root/'dist/preview/geometry-HUH-units.json'))['features'] if f['id']=='mtr_unit_polygon.2575')
assert unit['properties']['unit_category']=='elevator' and unit['properties']['level_name_en']=='Exit B2 Elevator Ground Level'
assert contains(huh['coordinates'],unit)
offset=math.hypot((huh['coordinates'][0]-source_c[0])*103000,(huh['coordinates'][1]-source_c[1])*111000)
assert offset<.01 and abs(huh['coordinates'][2]-source_c[2])<.001
portal={'id':'HUH:portal:B2-lift','station_id':'HUH','region_id':'HUH','name':'紅磡站 B2 升降機入口','level':'G','level_name':'Exit B2 Elevator Ground Level','node_id':huh['id'],'coordinates':huh['coordinates'],'source_coordinates':source_c,'offset_m':round(offset,4),'max_association_distance_m':.01,'max_height_difference_m':.001,'facility_kind':'lift','source_feature_id':'mtr_amenity_point.2654','unit_feature_id':unit['id'],'source_url':source,'operator_source_url':'https://www.mtr.com.hk/archive/ch/services/layouts/huh.pdf','evidence':'OFFICIAL_ELEVATOR_AMENITY_WITHIN_1CM_OF_EXISTING_GRAPH_NODE_INSIDE_OFFICIAL_ELEVATOR_UNIT','live_verified':False,'outdoor_approach_verified':False,'warnings':['此為 B2 升降機設施點，與 B2 樓梯口分開。原入口至此處的街面繞行與即時運作未核驗。']}
g['portals']=[x for x in g['portals'] if x['id']!=portal['id']]+[portal]
# Platform-area target must not be artificially stranded on the stair foot.
old='KOW:N:4317a000beb1c0';new=nodes['KOW:N:0666822338f9f1'];target=g['station_targets']['KOW']['TCL'];assert target['node_id'] in [old,new['id']]
platform=next(f for f in json.load(open(root/'dist/preview/geometry-KOW-units.json'))['features'] if f['id']=='mtr_unit_polygon.3077')
assert platform['properties']['unit_category']=='platform' and contains(new['coordinates'],platform)
assert abs(new['coordinates'][2]-platform['properties']['level_z_value'])<.001
correction='Previous platform-area anchor was the foot of a stair, isolated for strict accessibility by source barrier edge 1001057535. Existing node 0.399m away is inside the same official platform polygon (excluding holes) and on the accessible platform network. No edges or barrier classifications changed.'
target.update(node_id=new['id'],coordinates=new['coordinates'],supersedes_node_id=old,anchor_correction=correction)
for x in g['portals']:
 if x['id']=='KOW:platform-area:TCL':x.update(node_id=new['id'],coordinates=new['coordinates'],source_coordinates=new['coordinates'],supersedes_node_id=old,anchor_correction=correction)
# Recompute declared reachability instead of hand-maintaining success booleans.
for sid in g['station_targets']:
 ev=g['station_model_evidence'][sid];entries=[x for x in g['portals'] if x['station_id']==sid and ':portal:' in x['id']];ev['entry_count']=len(entries);ev['directed_coverage']=[]
 for mode in ['ordinary','lift']:
  edges=[e for e in g['edges'] if e['region_id']==sid and not e.get('disabled') and (mode=='ordinary' or (e['accessible_eligible'] and e.get('wheelchair_barrier')==2 and e['kind'] not in ['stairs','escalator','stairlift','travelator','rail','transfer','station_access','access_connector']))]
  for entry in entries:
   forward=reach(entry['node_id'],edges);backward=reach(entry['node_id'],edges,True)
   for k,t in g['station_targets'][sid].items():ev['directed_coverage'].append({'portal_id':entry['id'],'target':k,'profile':mode,'entry_to_target':t['node_id'] in forward,'target_to_entry':t['node_id'] in backward})
assert g['nodes']==before['nodes'] and g['edges']==before['edges']
strict=[e for e in g['edges'] if e['accessible_eligible'] and not e.get('disabled')]
for sid,pid,keys in [('HUH',portal['id'],['EAL','TML']),('KOW','KOW:portal:E1',['TCL'])]:
 n=next(x['node_id'] for x in g['portals'] if x['id']==pid)
 for reverse in [False,True]:
  rs=reach(n,strict,reverse)
  for key in keys:assert g['station_targets'][sid][key]['node_id'] in rs
for sid in ['HUH','KOW']:
 was=before['station_model_evidence'][sid]['directed_coverage'];now=g['station_model_evidence'][sid]['directed_coverage'];count=lambda rows:sum(x['entry_to_target']+x['target_to_entry'] for x in rows if x['profile']=='lift')
 actual_before=0
 for entry in before['portals']:
  if entry['station_id']!=sid or ':portal:' not in entry['id']:continue
  for reverse in [False,True]:
   rs=reach(entry['node_id'],strict,reverse)
   actual_before+=sum(t['node_id'] in rs for t in before['station_targets'][sid].values())
 print(sid,'strict directed successes:',actual_before,'->',count(now),'previous_declared',count(was),'entries',g['station_model_evidence'][sid]['entry_count'])
g.pop('version',None);g['version']=hashlib.sha256(json.dumps(g,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:16]
if a.apply:
 path.write_bytes(gzip.compress(json.dumps(g,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
 coverage_path=root/'dist/preview/station-model-coverage.json';coverage=json.load(open(coverage_path));coverage['stationGraphVersion']=g['version'];coverage['routingGraphModified']=True
 coverage['endpointCorrectionPolicy']='Source-backed entrance/target changes only; nodes, edges, barriers and directions preserved.'
 for sid in g['station_targets']:
  coverage['stationNetworkEvidence'][sid]=g['station_model_evidence'][sid];coverage['rail'][sid]['entryCount']=g['station_model_evidence'][sid]['entry_count']
 coverage_path.write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n')
 # Upper-level planning can offer a real alternative without silently changing an origin.
 alternatives=[]
 for sid,ev in g['station_model_evidence'].items():
  entries={p['id']:p for p in g['portals'] if p['station_id']==sid and ':portal:' in p['id']}
  rows=ev['directed_coverage']
  for row in rows:
   if row['entry_to_target'] and row['target_to_entry']:continue
   origin=entries[row['portal_id']]
   matching=[r for r in rows if r['target']==row['target'] and r['profile']==row['profile'] and r['entry_to_target'] and r['target_to_entry']]
   choices=[]
   for alt in matching:
    dest=entries[alt['portal_id']];aa,bb=origin['coordinates'],dest['coordinates']
    distance=round(math.hypot((aa[0]-bb[0])*103000,(aa[1]-bb[1])*111000),1)
    choices.append({'portal_id':dest['id'],'name':dest['name'],'node_id':dest['node_id'],'coordinates':dest['coordinates'],'straight_line_separation_m':distance,'connector_status':'NOT_VERIFIED','requires_explicit_new_origin_selection':True,'automatically_relocate_origin':False})
   choices.sort(key=lambda x:x['straight_line_separation_m'])
   alternatives.append({**row,'selected_entry_name':origin['name'],'alternatives':choices[:3]})
 alternative_data={'station_graph_version':g['version'],'scope':'Verified indoor endpoint alternatives, not a routed street detour','policy':'Preserve the selected origin. No connecting edge is inferred from distance. Explicitly choose a new lift entrance only after disclosing that the approach is unverified.','area_graph_limit':'Existing area graph chiefly covers ADM/AUS; HUH B2 lift node is absent. No certified outdoor connection was added.','entries':alternatives}
 (root/'dist/preview/station-access-alternatives.json').write_text(json.dumps(alternative_data,ensure_ascii=False,indent=2)+'\n')
 print('Applied endpoint-only corrections; graph version',g['version'])
else:print('Dry run passed; no files written.')
