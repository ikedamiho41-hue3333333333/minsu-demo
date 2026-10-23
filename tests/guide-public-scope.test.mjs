import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/catalog.mjs';
import {upgradeExperience,contentRecord} from '../src/experience.mjs';
import {handbookMarkup} from '../src/guide-ui.mjs';
import {guestPublishedItem} from '../src/guide.mjs';

test('handbook exposes confirmed room-specific operations only in the exact shared unit',()=>{
 const w=upgradeExperience(createWorkspace()),p=w.properties['lake-inn'].state.published;
 p.experience.guide.steps.push(contentRecord('unit-curtain','lake-inn',{unitId:'sea-king',title:'专属窗帘操作',text:'先按左侧开关，再拉右边细绳。',phase:'during',sourceLabel:'独立测试资料',confirmation:{status:'confirmed',by:'测试者',at:'2026-10-23'}}));
 p.facts.checkin={text:'听海专属入住规则',propertyId:'lake-inn',unitId:'sea-king'};
 assert.match(handbookMarkup('lake-inn',p,'sea-king'),/专属窗帘操作/);
 assert.match(handbookMarkup('lake-inn',p,'sea-king'),/听海专属入住规则/);
 for(const unit of ['sea-twin',null]){assert.doesNotMatch(handbookMarkup('lake-inn',p,unit),/专属窗帘操作|听海专属入住规则/);}
});
test('guest material rejects explicit unpublished states even for legacy metadata without confirmation',()=>{
 for(const status of ['pending','draft','unconfirmed','disabled','cancelled','ended','expired'])assert.equal(guestPublishedItem({text:'不可对客的规则',status},'lake-inn'),false,status);
 assert.equal(guestPublishedItem({text:'已有公开说明'},'lake-inn'),true);
});
