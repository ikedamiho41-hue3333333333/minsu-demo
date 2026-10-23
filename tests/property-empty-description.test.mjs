import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkspace,createRoom,saveSpace} from '../src/catalog.mjs';
test('optional room and space descriptions may be empty without blocking a draft save',()=>{
 let w=createRoom(createWorkspace(),'lake','lake-inn',{name:'测试房间',description:''});
 assert.ok(w.properties['lake-inn'].state.draft.rooms.at(-1).description.includes('待补充'));
 w=saveSpace(w,'lake','lake-inn',null,{name:'测试空间',description:''});
 assert.ok(w.properties['lake-inn'].state.draft.spaces.at(-1).description.includes('待补充'));
});
