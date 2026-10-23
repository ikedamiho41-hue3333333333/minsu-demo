import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/catalog.mjs';
import {answer} from '../src/model.mjs';
test('disabled published rooms cannot be cited by AI through stale room context',()=>{
 const s=createWorkspace().properties['lake-inn'].state;
 s.published.rooms[0].enabled=false;
 const r=answer(s,'这个房间床有多大',{roomId:s.published.rooms[0].id});
 assert.equal(r.status,'needs_clarification');
 assert.equal(r.sources.length,0);
});
