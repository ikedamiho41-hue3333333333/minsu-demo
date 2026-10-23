import test from 'node:test';
import assert from 'node:assert/strict';
import {readRecommendationForm,selectRecommendations} from '../src/recommendations.mjs';
import {contentRecord,emptyExperience} from '../src/experience.mjs';

function form(kind='route'){
 const data=new FormData();
 for(const [key,value] of Object.entries({kind,name:'按名称建立的测试路线',sourceLabel:'独立测试来源',period:'half',durationMinutes:'180',enabled:'on'}))data.set(key,value);
 return data;
}

test('named checkbox selections preserve distinct same-name place identities after the hidden empty sentinel',()=>{
 const data=form();data.append('placeIds','');data.append('placeIds','tea-room-a');data.append('placeIds','tea-room-b');
 const route=readRecommendationForm(data,null,'pilot');
 assert.deepEqual(route.placeIds,['tea-room-a','tea-room-b']);assert.equal(route.confirmation.status,'pending');
});

test('checkbox values and legacy comma-separated values are combined without losing later selections',()=>{
 const data=form();data.append('placeIds','');data.append('placeIds','tea, garden');data.append('placeIds','gallery');data.append('placeIds','tea');
 assert.deepEqual(readRecommendationForm(data,null,'pilot').placeIds,['tea','garden','gallery']);
 const benefitForm=form('benefit');benefitForm.append('placeIds','');benefitForm.append('placeIds','tea');benefitForm.append('placeIds','garden');
 const benefit=readRecommendationForm(benefitForm,null,'pilot');assert.deepEqual(benefit.placeIds,['tea','garden']);assert.equal(benefit.placeId,'tea');
});

test('partial edits without association fields retain unit, parent and all previous stops',()=>{
 const previous=contentRecord('existing-route','pilot',{kind:'route',name:'原路线',sourceLabel:'原来源',period:'half',durationMinutes:180,placeIds:['tea-room-b','tea-room-a'],unitId:'room-b',parentPlaceId:'courtyard'}),before=structuredClone(previous);
 const data=form();data.set('id','existing-route');
 const next=readRecommendationForm(data,previous,'pilot');
 assert.deepEqual(next.placeIds,['tea-room-b','tea-room-a']);assert.equal(next.unitId,'room-b');assert.equal(next.parentPlaceId,'courtyard');assert.deepEqual(previous,before);
 const benefit={...previous,id:'existing-benefit',kind:'benefit',placeId:'tea-room-b'};data.set('id',benefit.id);data.set('kind','benefit');
 const edited=readRecommendationForm(data,benefit,'pilot');assert.deepEqual(edited.placeIds,['tea-room-b','tea-room-a']);assert.equal(edited.placeId,'tea-room-b');
});

test('unchecking all linked places explicitly clears pending drafts and cannot produce public routes or entitlements',()=>{
 const previous=contentRecord('existing-route','pilot',{kind:'route',name:'原路线',sourceLabel:'原来源',period:'half',durationMinutes:180,placeIds:['tea'],confirmation:{status:'confirmed',by:'测试确认人',at:'2026-10-23'}});
 const data=form();data.set('id',previous.id);data.append('placeIds','');
 const route=readRecommendationForm(data,previous,'pilot');assert.deepEqual(route.placeIds,[]);assert.equal(route.confirmation.status,'pending');
 const benefitForm=form('benefit');benefitForm.set('id','existing-benefit');benefitForm.append('placeIds','');
 const benefit=readRecommendationForm(benefitForm,{...previous,id:'existing-benefit',kind:'benefit',placeId:'tea'},'pilot');
 assert.deepEqual(benefit.placeIds,[]);assert.equal(benefit.placeId,'');
 const experience=emptyExperience('pilot');experience.recommendations.routes=[route];experience.recommendations.benefits=[benefit];
 const selected=selectRecommendations({version:1,experience},{propertyId:'pilot'});assert.deepEqual(selected.routes,[]);assert.deepEqual(selected.benefits,[]);
});
