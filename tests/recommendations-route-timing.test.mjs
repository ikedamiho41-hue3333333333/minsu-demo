import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/recommendations.mjs';
import {contentRecord,emptyExperience} from '../src/experience.mjs';

const scope={propertyId:'timing-pilot'},confirmation={status:'confirmed',by:'演示操作者（测试）',at:'2026-10-23'};
const place=(id,values={})=>contentRecord(id,'timing-pilot',{name:'测试地点'+id,sourceLabel:'独立测试来源',confirmation,period:'half',durationMinutes:90,...values});
function snapshot(places,routeValues={}){
 const experience=emptyExperience('timing-pilot');experience.recommendations.places=places;
 experience.recommendations.routes=[contentRecord('route','timing-pilot',{name:'测试半日路线',sourceLabel:'独立测试来源',confirmation,period:'half',durationMinutes:180,placeIds:places.map(item=>item.id),...routeValues})];
 return {version:1,experience};
}

test('a 180-minute half-day route cannot publish a 360-minute full-day gallery as one of its stops',()=>{
 const s=snapshot([place('tea'),place('gallery',{name:'测试全天画廊',period:'day',durationMinutes:360})]);
 assert.equal(api.recommendedRouteById('route',s,scope),null);
 assert.deepEqual(api.selectRecommendations(s,scope,{period:'half'}).routes,[]);
 assert.equal(typeof api.routeTimingIssue,'function');assert.match(api.routeTimingIssue(s.experience.recommendations.routes[0],s.experience.recommendations.places),/半天.*一天|半天.*全日/);
});

test('known stop durations cannot add up to more than the route even when every stop is marked half-day',()=>{
 const s=snapshot([place('first',{durationMinutes:100}),place('second',{durationMinutes:100})]);
 assert.equal(api.recommendedRouteById('route',s,scope),null);assert.deepEqual(api.selectRecommendations(s,scope).routes,[]);
 const reason=api.routeTimingIssue(s.experience.recommendations.routes[0],s.experience.recommendations.places);assert.match(reason,/200/);assert.match(reason,/180/);
 s.experience.recommendations.routes[0].durationMinutes=200;
 assert.equal(api.routeTimingIssue(s.experience.recommendations.routes[0],s.experience.recommendations.places),'');assert.equal(api.recommendedRouteById('route',s,scope).id,'route');
});

test('an explicit full-day project cannot be squeezed into a half-day route by leaving its duration unknown',()=>{
 const s=snapshot([place('gallery',{period:'day',durationMinutes:null})]);
 assert.equal(api.recommendedRouteById('route',s,scope),null);assert.deepEqual(api.selectRecommendations(s,scope).routes,[]);
});

test('unknown stop durations stay unknown without invented totals or travel time while known durations still count',()=>{
 assert.equal(typeof api.routeTimingIssue,'function');
 const stops=[place('known',{durationMinutes:60}),place('null',{durationMinutes:null}),place('missing',{durationMinutes:undefined}),place('text',{durationMinutes:'待补'}),place('invalid',{durationMinutes:NaN})];
 const s=snapshot(stops),before=structuredClone(s),route=s.experience.recommendations.routes[0];
 assert.equal(api.routeTimingIssue(route,stops),'');assert.equal(api.recommendedRouteById('route',s,scope).id,'route');
 assert.deepEqual(s,before);assert.equal(stops[1].durationMinutes,null);assert.equal(stops[2].durationMinutes,undefined);
 route.durationMinutes=50;assert.match(api.routeTimingIssue(route,stops),/60/);assert.equal(api.recommendedRouteById('route',s,scope),null);
});

test('day routes may combine half-day and full-day stops when their known durations fit',()=>{
 assert.equal(typeof api.routeTimingIssue,'function');
 const s=snapshot([place('tea'),place('gallery',{period:'day',durationMinutes:360})],{name:'测试一日安排',period:'day',durationMinutes:480});
 assert.equal(api.routeTimingIssue(s.experience.recommendations.routes[0],s.experience.recommendations.places),'');
 assert.equal(api.recommendedRouteById('route',s,scope).id,'route');assert.deepEqual(api.selectRecommendations(s,scope,{period:'day'}).routes.map(route=>route.id),['route']);
});
