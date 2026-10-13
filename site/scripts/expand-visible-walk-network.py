import json,gzip,pathlib,collections,hashlib,math,time
import argparse
ap=argparse.ArgumentParser(description='Expand existing area with count-verified official CSDI visible-rectangle features, preserving all existing topology.');ap.add_argument('--source-dir',required=True);ap.add_argument('--base',required=True);ap.add_argument('--output',required=True);args=ap.parse_args();root=pathlib.Path(args.source_dir)
area=json.load(gzip.open(args.base));original_counts=[len(area['nodes']),len(area['edges'])]
bounds=json.load(open(root/'bounds.json'));features=[]
for p in sorted(root.glob('page-*.json')):
 if '.meta.' not in p.name:features+=json.load(open(p))['features']
assert len(features)==json.load(open(root/'count.json'))['count']; assert len(set(f['properties']['OBJECTID'] for f in features))==len(features)
def xyz(c):return (round(c[0],8),round(c[1],8),round(c[2],3))
lookup={(n['region_id'],xyz(n['coordinates'])):n['id'] for n in area['nodes'] if len(n['coordinates'])>2}
physical={e['physical_id'] for e in area['edges']};counts=collections.Counter();byreg=collections.Counter()
def node(c,region):
 key=(region,xyz(c))
 if key not in lookup:
  nid=region+':N:expanded:'+hashlib.sha256(str(key).encode()).hexdigest()[:16];lookup[key]=nid;area['nodes'].append(dict(id=nid,region_id=region,coordinates=list(key[1])))
 return lookup[key]
kinds={2:'footbridge',4:'subway',8:'escalator',9:'travelator',10:'lift',11:'ramp',12:'stairs',13:'stairlift',16:'escalator',17:'travelator',18:'lift',19:'ramp',20:'stairs',21:'stairlift',30:'crossing',31:'crossing',32:'crossing',33:'crossing'}
for f in features:
 p=f['properties']; coords=f['geometry']['coordinates']; assert f['geometry']['type']=='LineString'
 region='ADM' if sum(c[1] for c in [coords[0],coords[-1]])/2<22.2915 else 'AUS';pid=f"{region}:P:{p['PedestrianRouteID']}"
 if pid in physical:counts['already_present']+=1;continue
 if p['Enabled']!=1:counts['disabled']+=1;continue
 if p['Location']==3:counts['paid_area']+=1;continue
 if p['AccessTimeID'] is not None:counts['unresolved_access_hours']+=1;continue
 coords=[list(xyz(c)) for c in coords];a=node(coords[0],region);b=node(coords[-1],region)
 if a==b:counts['self_loop']+=1;continue
 kind=kinds.get(p['FeatureType'],'walk'); length=round(float(p['Shape_Length']),6);duration=round(length/(.6 if kind in ['stairs','escalator','stairlift'] else 1.2),6)
 if kind=='lift':duration=round(45+length,6)
 accessible=p['WheelchairBarrier']==2 and kind not in ['stairs','escalator','stairlift','travelator','lift']
 e=dict(id=pid,physical_id=pid,from_id=a,to_id=b,region_id=region,kind=kind,name=p.get('AliasNameTC') or p.get('StreetNameTC') or p.get('AliasNameEN') or p.get('StreetNameEN') or {'walk':'步道','stairs':'樓梯','lift':'升降機'}.get(kind,kind),length_m=length,duration_s=duration,coordinates=coords,source_id='CSDI-PEDESTRIAN',wheelchair_barrier=p['WheelchairBarrier'],access_time_id=None,location=p['Location'],direction=p['Direction'],geometry_mode='official',snap_eligible=p['Location']==1 and kind not in ['stairs','escalator','lift','travelator','stairlift'],accessible_eligible=accessible,disabled=False)
 if p['Direction'] in [None,0,1]:area['edges'].append(e)
 if p['Direction'] in [None,0,-1]:area['edges'].append(dict(e,id=pid+':r',from_id=b,to_id=a,coordinates=coords[::-1]))
 physical.add(pid);counts['added_physical']+=1;byreg[region]+=1
# Union acquired rectangles is expressed explicitly; selection bounds retained as enclosing bbox.
# Radius only bounds this envelope, rather than deleting valid source segments by distance.
for r in area['regions']:
 old=r['selection_bounds']; new=[bounds[0],bounds[1] if r['id']=='ADM' else 22.2915,bounds[2],22.2915 if r['id']=='ADM' else bounds[3]]
 r['selection_envelopes']=r.get('selection_envelopes',[old]);
 if new not in r['selection_envelopes']:r['selection_envelopes'].append(new)
 r['selection_bounds']=[min(old[0],new[0]),min(old[1],new[1]),max(old[2],new[2]),max(old[3],new[3])];r['bounds']=r['selection_bounds'];r['radius_m']=math.ceil(max(math.hypot((x-r['center'][0])*111320*math.cos(r['center'][1]*math.pi/180),(y-r['center'][1])*111320) for x in [r['bounds'][0],r['bounds'][2]] for y in [r['bounds'][1],r['bounds'][3]])+20);r['scope_note']='Count-verified official XYZ pedestrian graph in original acquired bounds plus initial visible map rectangle; no inferred crossing joins.'
area['source']['visible_map_expansion']={'bounds':bounds,'feature_count':len(features),'acquired_at':'2026-10-11','source_url':'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0','join_rule':'Existing region + exact XYZ rounded 1e-8 degrees / 1mm; no new geometric connectors','counts':dict(counts),'by_region':dict(byreg),'source_pages':[{**json.load(open(p)),'filename':p.name.replace('.meta.json','')} for p in sorted(root.glob('page-*.meta.json'))]}
area['source']['selection_radius_m_by_region']={r['id']:r['radius_m'] for r in area['regions']};area['source']['selection_bounds_by_region']={r['id']:r['selection_bounds'] for r in area['regions']}
area['version']=hashlib.sha256(json.dumps(area,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()[:16]
b=json.dumps(area,separators=(',',':'),ensure_ascii=False).encode();out=pathlib.Path(args.output);out.write_bytes(gzip.compress(b,compresslevel=9,mtime=0))
report=dict(original_counts=original_counts,expanded_counts=[len(area['nodes']),len(area['edges'])],json_bytes=len(b),gzip_bytes=out.stat().st_size,counts=dict(counts),byregion=dict(byreg),regions=area['regions']);(root/'build-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps(report,ensure_ascii=False,indent=2))
