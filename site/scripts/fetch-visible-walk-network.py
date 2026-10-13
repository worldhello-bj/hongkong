import urllib.request,urllib.parse,json,time,hashlib,concurrent.futures,pathlib
import argparse
ap=argparse.ArgumentParser(description='Download count-verified CSDI pedestrian source for fixed initial visible map extent.');ap.add_argument('--output-dir',required=True);args=ap.parse_args();root=pathlib.Path(args.output_dir);root.mkdir(parents=True,exist_ok=True);base='https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0/query'
bounds=[114.165-1700/102900,22.279-2100/111320,114.165+3700/102900,22.279+4400/111320]
common=dict(where='1=1',geometry=','.join(map(str,bounds)),geometryType='esriGeometryEnvelope',inSR=4326,spatialRel='esriSpatialRelIntersects')
def get(name,params):
 p=root/name;u=base+'?'+urllib.parse.urlencode(params)
 if p.exists():return json.loads(p.read_text())
 for attempt in range(4):
  try:
   b=urllib.request.urlopen(u,timeout=90).read();j=json.loads(b)
   if 'error' in j:raise ValueError(j)
   p.write_bytes(b);(root/(name+'.meta.json')).write_text(json.dumps(dict(url=u,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),received_at=time.time()),indent=2));print(name,len(b),len(j.get('features',[])),flush=True);return j
  except Exception as e:print(name,str(e),flush=True);time.sleep(2)
 raise RuntimeError(name)
c=get('count.json',dict(common,f='json',returnCountOnly='true'))['count'];print('count',c,bounds,flush=True)
(root/'bounds.json').write_text(json.dumps(bounds))
def page(off):return get(f'page-{off:06}.json',dict(common,f='geojson',outFields='*',outSR=4326,returnZ='true',resultRecordCount=3000,resultOffset=off,orderByFields='OBJECTID'))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex: list(ex.map(page,range(0,c,3000)))
