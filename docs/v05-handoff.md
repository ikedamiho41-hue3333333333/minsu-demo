# 民宿工具 v0.5 前端交接

当前补丁版本为0.5.1（20261023-v051）：仅补NAS无MIME时的海报封面解析，已完成460项测试与真实NAS原入口11项浏览器检查。NAS原路径已同步并回读文件哈希一致，回退副本保留；未改变NAS服务或网络暴露。0.5.0阶段验收表和截图在下文作为基线保留，当前文件哈希以release.json及本机NAS同步证据为准。

编制日期：2026-10-23。对应《前端原型v0.5-执行阶段与验收标准.md》的S6-10。本文件依据当前源码及已存在的阶段证据编制，只读核对了副本范围，没有执行发布、启动后端、修改用户浏览器数据或替真人签收。

**v0.5.0最终构建已完成本机技术验收，公网回读在本次交付记录另行登记。** 源码位于`前端v0.5-执行工作区`，分支`codex/v05-execution-20261023`；发布源为`外网手机演示-GitHubPages`。真实经营资料、实体手机/微信与真人体验继续独立登记。

| 最终交付项 | 结果 |
| --- | --- |
| 应用版本 | 0.5.0 / 20261023-v05 |
| 构建时间 | 2026-10-23T10:58:19.470Z |
| index.html SHA-256 | 303d6d2cf321823c213e8db1f26f07427de3580db802c65f1484c40247044ab7 |
| index.html 字节数 | 610070 |
| 本机验证 | 449测试、30问闭环、120原题别名、6反例；78页面尺寸组合、14完整流程断言、9恢复断言通过 |
| 独立审查 | 3项Important已修复，最终同构建17项复验通过 |
| 公网入口 | https://ikedamiho41-hue3333333333.github.io/minsu-demo/?mobile=1&property=qinghuan-dali&release=20261023-v05#/guest/home |
| 公网回读与副本 | 以本机S6/发布回读.json、模块副本核验.json的实际结果为准 |
| 实体手机/微信、首次体验者 | 待验收，未用桌面模拟替代；真人参与0人 |

## 1. 实际页面和入口

Hash路由不包含真实账号权限。`property`查询参数确定房源；对客分享链接另含`unit`、`share=1`和`generation`，可保留`mobile=1`。应通过商家房源卡生成完整链接，不手工拼接出租单元或代际。

| 端与入口 | 路由 | 当前内容 |
| --- | --- | --- |
| 客人：这家民宿 | `#/guest/home` | 突出的参考VR和AI入口、当前出租单元、规则、如何到店、房间/空间入口 |
| 客人：房间与公共空间 | `#/guest/rooms`、`room/:id`、`space/:id` | 当前公开并启用的房间、空间详情和带对象咨询；下级路径均位于`#/guest/` |
| 客人：VR | `#/guest/vr` | 指定第三方参考体验、非本店实拍说明、原站回退 |
| 客人：入住指南 | `#/guest/handbook` | 入住前/入住中/退房后三阶段、30问及当前公开规则 |
| 客人：如何到店 | `#/guest/arrival` | 民宿位置、停车点、实际入口，最后一段图文、媒体及联系出口 |
| 客人：周边推荐 | `#/guest/life` | 少量已确认测试精选或明确空态；半天/一天、同行偏好筛选 |
| 客人：精选详情 | `#/guest/recommended-place/:id`、`#/guest/recommended-route/:id` | 位置、停留时间、费用/预约/交通核验状态、来源、导航、对象咨询 |
| 客人：完整资料预览 | `#/guest/life-library`及`life-place/:id`、`life-route/:id`、`life-lead/:id` | 清欢原有85条地点/区域/空间、5主题、9活动来源；保留分类、搜索、冲突和待核验身份 |
| 客人：AI管家 / 本地向导 | `#/guest/chat`、`#/guest/life-chat` | 两种范围明确切换，独立未发送草稿、对象可见/移除、来源版本及人工交接 |
| 商家：接待工作台 | `#/merchant/home` | 当前房源待办、同商家其他房源提示、建档、房源卡分享与二维码/海报 |
| 商家：咨询处理 | `#/merchant/queue`、`#/merchant/ticket/:id` | 待接手→处理中→人工回复，原会话只读回看、另行整理通用FAQ |
| 商家：民宿资料 | `#/merchant/editor` | 名称、介绍、规则、房间资料草稿及维护入口 |
| 商家：建档与出租单元 | `#/merchant/new-property`、`units`、`room-edit/:id`、`space-edit/:id` | 新增房源、房间/公共空间，经营方式草稿、启停；下级路径均位于`#/merchant/` |
| 商家：指南和精选维护 | `#/merchant/guide-editor`、`#/merchant/recommendations` | 指南字段、媒体、推荐地点/路线/权益及来源；按名称选择单元、路线地点和父场所 |
| 商家：问答与周边 | `#/merchant/knowledge`、`knowledge-edit` | 公开问答草稿、相似问法、30问仍需人工确认状态及周边维护入口 |
| 商家：确认、预览、发布 | `#/merchant/publication`、`#/merchant/preview` | 测试确认记录、缺项直达、只读草稿客人预览、明确发布；预览不提交客人咨询 |
| 商家：VR及内部资料 | `#/merchant/vr`、`#/merchant/service` | 参考VR说明维护；清欢30问内部处置建议，不进入客人手册 |
| 平台演示 | `#/platform/home`、`activities`、`event-edit/:id` | 房源暂停/恢复、数据备份、演示活动维护/模拟更新；不是生产运营后台 |

客人四主入口固定为“这家民宿｜入住指南｜周边推荐｜AI管家”；商家三主入口为“接待工作台｜民宿资料｜问答与周边”。`share=1`将路由限制在客人端，但这仅是原型呈现，不能代替真实鉴权。

## 2. 字段、状态和数据边界

| 层级 | 实际字段 / 规则 |
| --- | --- |
| 工作区 | `schema:2`、`revision`、`merchants`、`properties`、演示`life`及历史`lifeChats`。每次写入检查revision，另一窗口更新时同步后要求重试 |
| 房源目录 | 稳定property key、`merchantId`、`city`、公开`rentalMode`、`shareGeneration`、每房源`state`；旧legacy的state/owner身份保留 |
| 房源状态 | `draft`、`published`、`draftDirty`、`visible`、`threads`、`tickets`、幂等`operations`。公开快照有独立`version/publishedAt`，与应用0.5版本号不同 |
| 房间 / 空间 | UUID稳定ID；房间含name/type/floor/area/beds/capacity/bath/photo/description/facilities/enabled；空间含id/name/key/description/enabled。新增和编辑只写草稿 |
| 出租方式 | `pending / room / whole`。pending不生成对客单元；按间分享具体room；整院只分享whole。发布经营方式变化递增shareGeneration，旧二维码不会因切回旧模式自行恢复有效 |
| 共享内容 | `experience.schema:1`、propertyId、dataIdentity；`guide`及`recommendations`。记录具有id/propertyId/unitId/sourceLabel、confirmation、visibility、enabled、cancelled、validFrom/validUntil |
| 指南 | `guide.points.property / parking / entrance`分别存address/lat/lng；`steps`、`media`、`contact`独立记录。没有已确认定位就不生成有效导航；媒体失败保留文字与联系出口 |
| 推荐 | `places / routes / benefits`。地点含name/address/lat/lng、durationMinutes、period、party；路线用placeIds引用稳定地点，拥有自己的时长；权益为说明，不是券或核销系统 |
| 推荐字段核验 | transport/booking/fee各自有Confirmed布尔。缺已确认出发点不报准确车程；half路线不能含day项目，已知站点时长之和不能超过路线总时长，未知时长不猜算 |
| 确认与发布 | `CONFIRM_DRAFT`要求操作者、来源及明确测试确认；`confirmation`含by/at、identity=test、businessConfirmed=false、scope及指纹。编辑使相关内容和全局确认失效；`PUBLISH`校验确认指纹后一次复制公开快照并递增版本 |
| 内容可见范围 | 普通公开读取只接受`public`。指南表单用`stay`表示入住专属，推荐表单用`resident`；两者当前均不公开。后端对接需统一这两个枚举，不能把它们解释为已经实现住客身份认证 |
| 对话与来源 | owner/thread/property/unit隔离；对象含kind/id/label/propertyId/unitId/version及推荐collection。消息冻结当时body/sources/version，原稿另保留sourceVersion；新发布只影响后续答复 |
| 人工咨询 | pending→processing→replied；重复交接不增重复票据，先接手再回复，只回原客人会话。人工回复不会自动公开，整理FAQ需主动填写可编辑通用草稿并另行确认发布 |

清欢现有30问、85条资料、5路线及9活动来源不是本轮新导入成果。没有真实资料时，默认保留“待确认”和“暂无已核实推荐”，不能从原稿价格、周期节日或共享设施推断本店承诺。

持久化使用独立`localStorage['minsu-mini-v050']`。首次有效v040/v030只复制到新key，先保留原文备份和迁移回执，旧key不改。旧页面后续保存不覆盖v050，也不自动合并。备份与恢复入口可下载原文、校验预览并确认导入，或先备份再新建独立示例；异常数据保持只读。客人身份、输入和所选对象存在sessionStorage，按房源/单元分键；没有可证明房源归属的旧同城向导记录仅存档，不复制进任意房源。浏览器profile及origin（协议、主机、端口）不同，数据也不同。

**本机新建房源和咨询不会自动出现在另一设备。** 当前分享链接定位稳定ID，另一浏览器没有该本地房源时应显示不存在，不能以默认样例替代。真实跨设备对客服务需要下一节的后端接口。

## 3. 三条客人核心流程和商家维护流程

1. **看房咨询：** 从商家房源卡复制/预览完整单元链接→客人看VR参考或房间/空间→带当前对象问规则→未知部分明确请管家确认→客人主动确认交接→商家接手并回复→同一客人原会话显示人工回复。停用、错误归属或旧代际链接不能换成其他房源继续展示。
2. **到店入住：** 首页“如何到店”→分别核对实际入口和停车点→仅对有效定位打开地图→看最后一段图文或视频→入住办理说明→找不到时使用公开联系获取方式。无定位保留可复制地址，视频/外链失败仍可看已有图文，不显示假播放成功。
3. **周边安排：** 选半天/一天及同行偏好→从已确认测试精选或匹配路线选择→比较位置、时长、费用/预约核验状态→有效定位导航或复制地址→带地点/路线进入本地向导继续问。原稿预览独立可达；待核、过期、取消和不适用权益不能成为当前可参加或已享有。

商家维护串联：新建房源→补房间/空间与实际出租方式→维护规则/指南/精选→保存草稿→填写测试操作者/来源并确认→只读客人预览→明确发布→生成/复制/预览同一单元链接与二维码→预览和下载介绍海报→修改规则后重新确认发布→核对页面及新答复，旧会话保持旧版本。路线维护按名称选择站点，不需要抄UUID；未知或无关联的记录可以留在待确认草稿，不能作为有效推荐。

二维码使用固定版本qrcode-generator（MIT）本地打包；测试用jsQR（Apache-2.0）对实际RGBA/PNG解码。海报750×1240，仅取公开基础介绍，封面明确AI示例图；无封面有文字回退。图片、地图外跳、下载和微信环境仍需按最终支持范围实测。

## 4. 现有接口和后续联调依赖

当前没有真实模型调用、登录鉴权、跨设备数据库、外部通知、订单、支付、派修或券核销。问答、人工流程、发布及内容维护在浏览器本地运行；地图、参考VR及配置的媒体可联网加载，这不代表业务后端或豆包已接入。`scripts/serve.mjs`只是监听127.0.0.1的静态文件服务。

| 当前模块 / 接口 | 作用 | 后续真实服务需要补齐 |
| --- | --- | --- |
| `catalog.mjs`：createProperty/createRoom/saveRoom/saveSpace/setDraftRentalMode/shareUrl/resolveTarget | 建档、归属、出租单元与分享代际 | 服务端房源/单元存储、商家授权、启停和代际校验，不能信任URL或前端角色 |
| `experience.mjs`、`guide.mjs`、`recommendations.mjs` | 内容范围、时效、确认、定位、路线关联和时长检查 | 版本化内容仓库、具名经营方确认、范围策略、撤回与有效期治理；对接枚举需规范化 |
| `publication.mjs` + dispatch的SAVE_DRAFT/CONFIRM_DRAFT/PUBLISH | 保存、测试确认、指纹、发布隔离 | 真实发布权限、审计、并发控制、持久版本与回滚；本地指纹只是变更检测，不是经营方电子签名 |
| `model.mjs`、`experience-answer.mjs`：answer/dispatch | 本店与本地范围、规则/操作/申请分型、已发布来源答复 | 豆包/检索适配、超时失败回退；服务端先校验property/unit/session/object/version，再将允许资料交给模型，模型不能直接改店规 |
| ASK/HANDOFF/ACCEPT/REPLY | 原问、对象和会话、幂等、接手回复 | 真实账号与住客访问、跨设备消息、接待时段、通知和未送达状态。建议请求保留propertyId/unitId/thread/session/scope/kind/id/version/operation |
| `local-life.mjs`、静态原稿库 | 示例活动、人工录入、模拟更新及原稿预览 | 经授权的真实活动源、场次/取消更新及来源核验；syncDemo不是抓取微信小程序或实时同步 |
| `share-artifacts.mjs`、guide外链 | 二维码/海报、公开导航/媒体 | 可公开真实素材的授权、失败处理、微信兼容及跨设备访问；不是微信SDK分享卡片或正式小程序 |

未来答复结构至少保留body/status/answerKind/mode、冻结sources（公开version及原稿sourceVersion）和resolvedContext；服务申请只能表达待确认/处理进度，不能写成已预约、已派修或已完成。具体HTTP端点、身份方案、模型配置和运维负责人尚未确定，本交接不虚设已存在的API。

## 5. 真实资料缺项

S0核对的11份原件（8份业务正文+3张截图）与2026-10-22基线哈希一致，原件未改。依据为[资料缺项清单](../../检查记录/前端原型v0.5/S0/资料缺项.md)及[原件登记](../../检查记录/前端原型v0.5/S0/原件与资料缺项.json)。本地未发现QH-01—08具名确认/日期/公开授权的完整回传；测试确认不补成真实确认。

| 资料组 | 运营试用前仍需提供或确认 |
| --- | --- |
| QH-01 主体与归属 | 品牌/社区/经营方关系、首处试点房源、稳定编号、维护/确认/发布/停用责任人及公开范围 |
| QH-02 出租与空间 | 实际按间或整院方式，真实房间/空间、床型人数面积设施、共享/房内限制对应表 |
| QH-03 到店停车 | 本店公开位置、停车点、实际入口及权限收费，准确定位、最后一段路书、夜雨提示和迷路出口 |
| QH-04 本店规则 | 30问适用规则、例外、费用、渠道/单元/有效期；公开、入住专属和内部SOP边界 |
| QH-05 接待承接 | 可维护的公开联系渠道、接待/夜间时段、替补与升级权限，真实通知与原会话接手责任 |
| QH-06 精选与路线 | 首批3—5个已核地点、从真实房源出发的半日路线、坐标/时长/预约/计价/限制与核验日期 |
| QH-07 活动权益 | 实际当期场次与取消状态；商户授权的权益条件、适用对象及有效期；不把9条来源线索推成当周活动 |
| QH-08 媒体授权 | 获授权的真实封面、房间/空间和路书媒体、拍摄/提供者与用途/撤回条件；真实VR可后补，继续保留参考标识 |

了巴价格单位、寂照庵预约、便利店时段、三月街日期、有风小院时间及“全程零门票/准确车程”等已知原稿冲突继续待核，不擅选某一版作为经营事实。演示不收真实门锁/WiFi凭据、证件、订单或客人隐私。

## 6. 测试和截图索引

证据根目录为本机`/Users/mac/Desktop/民宿工具/检查记录/前端原型v0.5/`，不随静态站点自动部署。以下是阶段证据索引，S6应另保存与最终构建一致的日志和截图。

| 阶段 | 现有记录 | 代表截图 / 专项 |
| --- | --- | --- |
| S0 | `S0/验收记录.json`、baseline-tests.log、baseline-30q.json、字段与迁移.md、原件与资料缺项.json | 原始源码tar、旧公开release及构建留档 |
| S1 | `S1/验收记录.json`、tests.log、browser.js | [房间空间维护](../../检查记录/前端原型v0.5/S1/output/playwright/S1-01-房间空间维护.png)、[四主入口](../../检查记录/前端原型v0.5/S1/output/playwright/S1-02-四个主入口.png) |
| S2 | `S2/验收记录.json`、tests.log、browser.js | [缺定位回退](../../检查记录/前端原型v0.5/S2/output/playwright/S2-02-缺定位回退.png)、[媒体失败保留图文](../../检查记录/前端原型v0.5/S2/output/playwright/S2-03-媒体失败仍可看图文.png) |
| S3 | `S3/验收记录.json`、tests.log、推荐API与领域证据.md | [偏好筛选](../../检查记录/前端原型v0.5/S3/output/playwright/S3-02-偏好筛选.png)、[原稿冲突待核](../../检查记录/前端原型v0.5/S3/output/playwright/S3-06-原稿冲突与待核.png) |
| S4 | `S4/验收记录.json`、tests.log、关键回归.log、30问及全部别名逐题记录.json、后端对接点.md | [本地向导人工原会话](../../检查记录/前端原型v0.5/S4/output/playwright/S4-05-本地向导人工回复原会话.png)；30原题+90别名120/120、6/6关键反例为独立领域验收 |
| S5 | `S5/验收记录.json`、browser.js、tests.log、build.log | [只读草稿预览](../../检查记录/前端原型v0.5/S5/output/playwright/S5-02-商家只读草稿预览.png)、[二维码与海报](../../检查记录/前端原型v0.5/S5/output/playwright/S5-05-分享二维码与海报.png)、[实际下载海报](../../检查记录/前端原型v0.5/S5/output/playwright/S5-06-实际下载海报.png) |
| S6 | 最终本机验证.json、final-tests.log、final-30q.log、final-v05.log、v05-acceptance.json | output/playwright/final-*为同一最终构建的三尺寸截图；full-flow-browser.js与layout-browser.js；独立代码审查.md及output/review-close-three-final.json；recovery-browser.js与实际下载原文 |

上述最终449项与阶段早期314/360/383/424数字分别对应各阶段，不混作同一轮。最终build及release哈希一致；30原题/90别名/6反例详见S6逐题输出。本轮发现的异常存储覆盖、范围显示、专属手册缺失、未知合问漏答及小屏视频溢出均已修复，并重跑受影响流程。

源码检查：`npm test`、`npm run acceptance`、`npm run acceptance:v05`、`npm run build`。构建重写index并输出output/build.json；如再次改源码，应重建并重验受影响项，不沿用此次截图作为新构建证据。

实体手机浏览器、微信内导航/视频/扫码/下载及首次体验者检查继续单列；没有真实设备或首次体验者时填待验收，不用桌面窄屏或脚本次数冒充真人通过。

## 7. 副本、发布和回退范围

本轮发布链为**隔离执行工作树→本机技术验收→GitHub Pages**；另同步`prototype-mini`本地模块镜像并独立验证。NAS、旧Sites、prototype与prototype-v2保留旧版，没有本轮部署授权扩展或同步声明。

| 目标 | 交付范围 |
| --- | --- |
| 前端v0.5-执行工作区 | 唯一实现与最终构建源，保留阶段提交 |
| 外网手机演示-GitHubPages | 原main基线0747f36；本轮采用快进整合并发布，实际提交与回读见S6发布证据 |
| prototype-mini | 保留5290启动方式；同步src/tests/assets、样式相对路径适配和媒体策略，备份及实际结果见S6模块副本核验 |
| NAS与团队在线演示-v0.4/dist | 本轮未同步；旧NAS记录不代表v0.5已部署 |
| prototype/prototype-v2/旧Sites | 历史保留，本轮未修改或代验 |

回退分为静态文件和浏览器资料两层：

1. **保留基线：** 旧源码提交0747f36及本机`S0/v0.4.3-source-0747f36.tar`、baseline-release.json/public-release.json可定位旧版；根执行者另留最终构建清单与发布前可回滚提交。回退静态站需恢复相配套的index/assets/release，不用旧NAS打包脚本覆盖新源码。
2. **保留本地资料：** 更新前保留房源/会话/草稿备份；存储异常时先保全原值与恢复副本，不能以示例初始化后再次保存覆盖原始资料。不要执行恢复示例或清空localStorage作为回退方法。
3. **独立演练再恢复：** 先在复制profile/独立origin核对旧构建能否读取保留数据；代码回退不等于所有新增字段或单元链接都自动回退。已实际演练：从归档0.4.3打开原v040并保存，再重开v0.5，v050字节保持不变；另通过真实文件上传恢复完整房源/会话/草稿。没有跨设备数据库恢复服务。
4. **副本各自核验：** prototype-mini本轮单独同步验收；NAS或旧站后续同步仍须分别部署和回读，本轮GitHub Pages结果不能替代它们的状态。

开发与技术交接可据此继续；真实经营确认、真人/真机验收、模型及后端接入保持独立责任和结果记录。
