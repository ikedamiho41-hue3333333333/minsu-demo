import test from 'node:test';
import assert from 'node:assert/strict';
import {isMobilePresentation,propertyUrl} from '../src/presentation.mjs';
import {createWorkspace,shareUrl} from '../src/catalog.mjs';

test('窄屏自动进入手机呈现，桌面仅在指定入口时进入',()=>{
 assert.equal(isMobilePresentation('',390),true);
 assert.equal(isMobilePresentation('',1440),false);
 assert.equal(isMobilePresentation('?mobile=1',1440),true);
 assert.equal(isMobilePresentation('?mobile=0',390),true);
});
test('切换商家房源保留手机入口，清除旧房间和分享限制',()=>{
 const u=new URL(propertyUrl('https://example.com/demo/?mobile=1&unit=old&share=1&version=old#/guest/chat','mountain-yard','merchant'));
 assert.equal(u.pathname,'/demo/');
 assert.equal(u.searchParams.get('mobile'),'1');
 assert.equal(u.searchParams.get('property'),'mountain-yard');
 assert.equal(u.searchParams.has('unit'),false);
 assert.equal(u.searchParams.has('share'),false);
 assert.equal(u.hash,'#/merchant/home');
});
test('手机入口生成的分享保留手机呈现且只进入具体房间的客人端',()=>{
 const u=new URL(shareUrl(createWorkspace(),{merchantId:'lake',propertyId:'lake-inn',unitId:'sea-twin',baseUrl:'https://example.com/?mobile=1#/merchant/home'}));
 assert.equal(u.searchParams.get('mobile'),'1');
 assert.equal(u.searchParams.get('share'),'1');
 assert.equal(u.searchParams.get('unit'),'sea-twin');
 assert.equal(u.hash,'#/guest/home');
});
