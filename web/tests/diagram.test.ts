import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {diagramLayout} from '../src/diagram';
const model=JSON.parse(readFileSync('../data/normalized/model.json','utf-8'));
const nodes=model.nodes.filter((n:any)=>n.venue_id==='ADM');
describe('Decluttered schematic',()=>{
 it('keeps every node at a distinct visible position, including coincident bus stops',()=>{
  const layout=diagramLayout(nodes,['ADM:entry','ADM:P7']);
  expect(layout.positions.size).toBe(nodes.length);
  const bus=nodes.filter((n:any)=>n.kind==='bus_stop');
  expect(new Set(bus.map((n:any)=>JSON.stringify(layout.positions.get(n.id)))).size).toBe(bus.length);
 });
 it('shows important labels without overlapping label boxes',()=>{
  const labels=[...diagramLayout(nodes,['ADM:entry','ADM:P7']).labels.values()];
  expect(labels.length).toBeGreaterThan(3);
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
   const a=labels[i].bounds,b=labels[j].bounds;
   expect(a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1]).toBe(false);
  }
 });
 it('reveals a selected bus label without mutating source geometry',()=>{
  const original=JSON.stringify(nodes);const bus=nodes.find((n:any)=>n.kind==='bus_stop');
  expect(diagramLayout(nodes,['ADM:entry','ADM:P7'],bus.id).labels.has(bus.id)).toBe(true);
  expect(JSON.stringify(nodes)).toBe(original);
 });
});
