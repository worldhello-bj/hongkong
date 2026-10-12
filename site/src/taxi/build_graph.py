"""Derive a compact directed driving graph; retain original OSM polyline bends."""
import xml.etree.ElementTree as ET,json,math,pathlib,collections,sys
P=pathlib.Path(__file__).parent
root=ET.parse(P/'osm-source.xml').getroot()
nodes={n.get('id'):[float(n.get('lon')),float(n.get('lat'))] for n in root.findall('node')}
def tags(el):return {t.get('k'):t.get('v') for t in el.findall('tag')}
def distance(a,b):return 6371000*2*math.asin(math.sqrt(math.sin(math.radians(b[1]-a[1])/2)**2+math.cos(math.radians(a[1]))*math.cos(math.radians(b[1]))*math.sin(math.radians(b[0]-a[0])/2)**2))
allowed={'motorway','trunk','primary','secondary','tertiary','unclassified','residential','service','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link','living_street'}
selected={};uses=collections.Counter();protected={'12857346894','9101644160'}
for r in root.findall('relation'):
 for m in r.findall('member'):
  if m.get('role')=='via' and m.get('type')=='node':protected.add(m.get('ref'))
for w in root.findall('way'):
 t=tags(w);refs=[n.get('ref') for n in w.findall('nd')];mode=next((t[k] for k in ['taxi','motorcar','motor_vehicle','vehicle','access'] if k in t),'yes')
 if t.get('highway') not in allowed or mode in ['no','private','agricultural','forestry'] or t.get('service') in ['parking_aisle','driveway','emergency_access'] or t.get('area')=='yes':continue
 if any(k in t for k in ['access:conditional','taxi:conditional','motorcar:conditional']):continue
 selected[w.get('id')]=(t,refs);uses.update(set(refs))
keys={'highway','name','name:en','oneway','junction','taxi','motorcar','motor_vehicle','vehicle','access','tunnel','bridge','layer','level','foot','service'}
edges=[];ways={};curb=set()
for wid,(t,refs) in selected.items():
 ways[wid]={k:v for k,v in t.items() if k in keys};oneway=t.get('oneway','yes' if t.get('junction')=='roundabout' or t['highway']=='motorway' else 'no')
 speed=4 if t['highway']=='service' else 12 if t['highway'] in ['motorway','trunk','motorway_link','trunk_link'] else 7
 def emit(chain):
  if len(chain)<2:return
  geom=[nodes[n] for n in chain];length=round(sum(distance(a,b) for a,b in zip(geom,geom[1:])),3);a,b=chain[0],chain[-1]
  if length<=0:return
  base={'way':wid,'lengthM':length,'durationS':round(length/speed,3)}
  if oneway!='-1':edges.append(dict(base,**{'from':a,'to':b,'geometry':geom}))
  if oneway not in ['yes','1','true']:edges.append(dict(base,**{'from':b,'to':a,'geometry':geom[::-1]}))
  if t['highway'] not in ['motorway','trunk','motorway_link','trunk_link'] and t.get('tunnel') not in ['yes','building_passage'] and t.get('bridge') not in ['yes','viaduct'] and t.get('foot')!='no':curb.update([a,b])
 chain=[];length=0
 for n in refs:
  if n not in nodes or not(114.115<=nodes[n][0]<=114.255 and 22.26<=nodes[n][1]<=22.355):emit(chain);chain=[];length=0;continue
  if chain:length+=distance(nodes[chain[-1]],nodes[n])
  chain.append(n)
  if len(chain)>1 and (uses[n]>1 or n in protected or length>=80):emit(chain);chain=[n];length=0
 emit(chain)
# Keep the main strongly connected urban network, including road harbour tunnels.
adj={};rev={}
for e in edges:adj.setdefault(e['from'],[]).append(e['to']);rev.setdefault(e['to'],[]).append(e['from'])
sys.setrecursionlimit(200000);seen=set();order=[]
def visit(v):
 if v in seen:return
 seen.add(v)
 for w in adj.get(v,[]):visit(w)
 order.append(v)
for v in list(adj):visit(v)
seen=set();comps=[]
def component(v,c):
 if v in seen:return
 seen.add(v);c.add(v)
 for w in rev.get(v,[]):component(w,c)
for v in reversed(order):
 if v not in seen:c=set();component(v,c);comps.append(c)
keep=max(comps,key=len);edges=[e for e in edges if e['from'] in keep and e['to'] in keep];usedways={e['way'] for e in edges};ways={k:v for k,v in ways.items() if k in usedways}
restrictions=[]
for r in root.findall('relation'):
 t=tags(r)
 if t.get('type')!='restriction' or 'taxi' in t.get('except','').split(';'):continue
 m={x.get('role'):x for x in r.findall('member')};f=m.get('from');to=m.get('to');via=m.get('via')
 if f is not None and to is not None and via is not None and via.get('type')=='node' and f.get('ref') in ways and to.get('ref') in ways:restrictions.append({'fromWay':f.get('ref'),'toWay':to.get('ref'),'via':via.get('ref'),'kind':t.get('restriction:motorcar',t.get('restriction',''))})
data={'metadata':{'source':'OpenStreetMap contributors','url':'https://www.openstreetmap.org/copyright','retrievedAt':'2026-10-11','snapshotUrl':'https://api.openstreetmap.org/api/0.6/map','bbox':[114.115,22.26,114.255,22.355],'license':'ODbL-1.0','trafficSide':'left','timing':'Synthetic speeds: urban7m/s, trunk/motorway12m/s, service4m/s; no live traffic.','limitations':'Compressed road polylines, one-way/access and via-node restrictions. Not lane-level navigation. Curb snapping is approximate, not a verified stopping permit.'},'nodes':{n:nodes[n] for n in sorted(keep)},'pickupNodeIds':sorted(curb&keep),'edges':edges,'ways':ways,'restrictions':restrictions}
(P/'road-graph.js').write_text('export const ROAD_GRAPH = '+json.dumps(data,separators=(',',':'),ensure_ascii=False)+';\n')
print(len(keep),'nodes',len(edges),'directed edges',len(restrictions),'restrictions',len(curb&keep),'curb candidates')
print('Tunnel road names:',sorted({t.get('name','') for t in ways.values() if t.get('tunnel')=='yes'}))
