# 清欢资料增补实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement the assigned tasks. Track steps with checkbox syntax.

**Goal:** 将用户已批准的清欢增补清单做进现有原型，客人能浏览具体攻略/路线并带上下文提问，商家能查看相关内部接待资料。

**Architecture:** 扩展现有本地生活、AI咨询和商家接待流程。清欢资料由只读、带来源的JSON提供；页面与本地问答共用同份资料。原件、既有房源事实/草稿/咨询与存储结构保持兼容，新增内容是待核验资料预览，未核实的经营字段不转为确定答复。

**Tech Stack:** 现有原生ES模块、CSS、JSON、Node test runner与rolldown；不新增产品依赖。

**Spec:** 项目既有《清欢资料融合-2026-10-22/01-资料与原型更新对照-v0.1.md》开头2026-10-23增补复核；用户在完整审阅建议后明确“开始增加”，继续当前窗口实施。

## Global Constraints

- 原型v0.4.3；现有清欢30问规则/草稿发布与人工原会话回复不回退。
- 全部清欢攻略仍为来源资料预览，未获商家业务确认；不声明折扣、预约成功、车程、实时营业/活动、真实VR或豆包已接。
- 地点保留66条攻略来源记录及其他主题候选，重复/多店保留标记，不冒称去重商户数量。
- 5条路线、9条活动日历线索、3处雨天备选保留来源；时间轴是建议到达时间，不是集合发车安排。
- 资料按当前城市/房源范围使用；清欢资料不混入莫干山或其他示例房源。
- 内部SOP只在商家页面展示，不进入客人AI的答案或来源；当前仍为演示身份，不形成真实权限系统。
- 活动线索与具体场次分开，原有用户数据不重置、不把线索写成active活动。

## Review Focus

1. 从地点/路线提问及刷新/改问后，不能丢对象或把旧对象带到另一房源；清空对象有明确操作。
2. 价格/时间/交通/预约等未核实字段，不能从原文或泛化推荐变成确定经营承诺。
3. 复合问题、短追问与雨天/半天/体力偏好应保留限制；不把没有资料的具体请求凑成答案。
4. 商家内部动作、赔付权限和联系方式不能泄漏到客人问答、手册、AI引用。
5. 320px手机、键盘、搜索空结果、无当前城市资料、过期/取消活动及旧浏览器存储应可用。

## Task 1 来源资料整理与核对

Files: create `src/qinghuan-content.json`, `tests/qinghuan-content-data.test.mjs`。

Produces: JSON `{version,categories,places,routes,activityLeads,rainPlaceIds}`。
Place `{id,name,aliases,category,summary,locationText,sourceRefs,status,origin,notes,sourceRow?}`；可保留`hoursOriginal/priceOriginal/contactOriginal/reservationOriginal`作为原始参考，客人页面/AI不自动当作已确认值。
Route `{id,title,audience,summary,stops:[{placeId,arrival,duration,label,optional}],sourceRefs,status,notes}`。
Activity lead `{id,title,frequency,locationText,summary,sourceRefs,status}`。Source ref `{file,location}`。

- [ ] 写来源覆盖检查并记录缺失状态；直接对照原表行、原幻灯片验证预期。
- [ ] 整理原始资料，补主题游独有点位与雷达、路线和活动线索，保留冲突/重复。
- [ ] 验证引用点位存在、题量/来源完整及原件未改，提交该独立增量。

## Task 2 商家接待资料与三阶段手册

Files: create `src/qinghuan-service.json`, `src/service-ui.mjs`, `tests/service-ui.test.mjs`。

Produces: `serviceDeskMarkup(propertyId,knowledge)` 商家资料页；`ticketServiceMarkup(propertyId,ticket,knowledge)` 按knowledgeIds显示内部处置卡；`guestHandbookMarkup(propertyId,knowledge)` 仅安全对客说明，带`select-guide`提问按钮；`serviceKnowledge` 导出供资料校验。
资料Q01—Q30均有对应责任岗位候选、整改优先级、需确认项目、内部动作摘要和来源。所有内部动作均待店方确认，不能作为执行工单/已批准时效。

- [ ] 先测试当前缺少商家处置/手册行为，保存RED。
- [ ] 从原表M/N/O与确认清单整理资料，完成三个纯渲染函数；对客只使用既有安全指南与明确缺项。
- [ ] 验证跨房源隔离、内部字段不进入对客手册、多题合问和HTML转义；提交该独立增量。

## Task 3 本地生活资料浏览、上下文问答与整体验证

Files: create `src/content.mjs`, `src/content-ui.mjs`, `tests/content.test.mjs`, `tests/content-ui.test.mjs`; modify `src/app.mjs`, `src/life-ui.mjs`, `src/local-life.mjs`, `src/styles.css`, package/release/README。

Consumes Task 1 JSON与Task 2三个渲染函数。资料层提供地点/路线/活动线索查询、资料问答和严格范围判断；现有`lifeAnswer`增加可选`{propertyId,context}`，无清欢范围时保持旧行为。清欢UI增加地点/路线/活动线索入口、搜索分类、详情、雨天备选与来源；Q19衔接保留原问题，地点/路线发问保留选中对象，清除上下文/刷新/切房源不串。

- [ ] 先测试地点搜索、路线关联、城市房源隔离、问答限制、组合/时间问题与上下文恢复，记录RED。
- [ ] 实现资料层和页面，接入既有路由、问答、商家详情和手册；不迁移用户业务存储。
- [ ] 完整领域测试与30问原链路验收；浏览器实测列表→详情→提问、Q19→本地生活、商家处置卡和手册，手机320/390及桌面核图。
- [ ] 独立代码审查并处理实质问题；构建v0.4.3、同步模块副本、更新既有公网、核对下载哈希，回写大纲与证据。

## 执行记录

2026-10-23：复用既有干净隔离工作区并新建`feat/qinghuan-content-v043`分支；基线257/257通过。原件11份此前核验未变。采用独立数据/服务资料任务并行，主代理负责本地生活行为、集成与最终验证；仅对本次分工使用独立新任务，避免共享文件冲突。
