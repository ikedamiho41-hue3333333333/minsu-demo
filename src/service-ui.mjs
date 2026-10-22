import data from './qinghuan-service.json' with {type: 'json'};

// Merchant material is deliberately separate from the public answer collection.
export const serviceKnowledge = data.items;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const phases = ['入住前', '入住中', '退房后'];
const isGuideId = id => /^Q(?:0[1-9]|[12]\d|30)$/.test(id ?? '');
const publicGuides = knowledge => (Array.isArray(knowledge) ? knowledge : [])
  .filter(item => item?.kind === 'confirmation_guide' && isGuideId(item.id));
const findPublicGuide = (knowledge, id) => publicGuides(knowledge).find(item => item.id === id);

// These are safe guest-facing missing facts, rather than the internal SOP
// checklist. In particular, no staffing, compensation authority or work orders.
const publicMissing = {
  Q01: '准确导航点、交通参考、接站是否提供及费用、预约方式和服务时段。',
  Q02: '对应出租单元的入口、楼栋门牌、日夜路书与核验入住身份后的门禁获取方式。',
  Q03: '可用停车位置、收费和入场规则；充电设施是否存在、当日可用情况及预约方式。',
  Q04: '标准入住退房时间、早入晚退条件和费用、行李寄存规则及当日房态。',
  Q05: '订单所列费用、押金和清洁费是否另收、退改条款与订单查询入口。',
  Q06: '是否接待宠物、适用单元、种类体型数量限制、费用与行为要求。',
  Q07: '是否含早、适用订单、供应地点时段和价格；厨房是否可用及使用清洁要求。',
  Q08: '本单元实拍或VR对应关系、拍摄日期、景观楼层及已知限制。',
  Q09: '本单元空调、取暖和除湿设备、实际使用说明及可借物品。',
  Q10: '能否开票、办理主体、项目金额、申请资料和入口。',
  Q11: '故障情况的联系入口、可提供的替代安排及后续通知方式。',
  Q12: '本房热水设备说明、安全使用提示与报修联系入口。',
  Q13: '本单元网络覆盖、授权WiFi凭据获取入口与可执行的排查说明。',
  Q14: '可用防虫用品、清洁或除虫处理的联系入口和适用条件。',
  Q15: '连住打扫政策、预约方式、可用时段和收费范围。',
  Q16: '可走夜间路线、照明情况、物业或安全联系入口及可借物品。',
  Q17: '实际共享设施、适用住客、可用时段、预约排队方法与替代方案。',
  Q18: '本单元隔音和临街情况、安静时段、可借用品及噪音联系入口。',
  Q19: '攻略地点的有效信息、可用时间与出行偏好；能否代订、费用和联系方法。',
  Q20: '实际洗衣和烘干设施、位置、时段、用品与收费规则。',
  Q21: '是否收取押金、原支付渠道、退回条件、到账时间和查询入口。',
  Q22: '超时费用、宽限条件、晚退申请方式和当日房态；行李寄存替代方案。',
  Q23: '遗留物联系和登记入口、认领核验、保管期限及邮寄费用规则。',
  Q24: '已告知的清洁费适用条件、正常使用界限、价目与争议查询入口。',
  Q25: '实际开票时效、进度查询、更正重开方式与办理入口。',
  Q26: '是否提供送站、实际费用、预约方式、服务时段及人数行李限制。',
  Q27: '投诉受理入口、服务时段与个案后续答复方式。',
  Q28: '是否确有老客权益、具体规则、有效期、适用房源和预订入口。',
  Q29: '正常损耗与损坏的区分、事前公示规则、复核和争议查询入口。',
  Q30: '可核实的售后联系入口、服务时段及夜间紧急联系获取方式。'
};

function sourceMarkup(sourceRef) {
  return `<p class="small muted service-source">来源：${esc(sourceRef?.file)} · ${esc(sourceRef?.location)}</p>`;
}

function publicSourceMarkup(guide) {
  return `<p class="small muted service-source">来源：${esc(guide.sourceLabel || `清欢30问 · ${guide.id}`)} · ${esc(guide.sourceRange || '来源位置待补充')}</p>`;
}

function merchantCard(item, knowledge, expanded = false) {
  const guide = findPublicGuide(knowledge, item.id);
  const title = guide?.question || item.question;
  const confirmed = guide?.requiresHuman === false;
  const content = `<p class="tag service-status">${confirmed ? '公开答复已确认；内部建议仍待店方确认' : '待店方确认'}</p>
    <div class="fact-row service-checklist"><span>确认清单</span><p>${esc(guide?.confirmationChecklist || item.confirmationChecklist)}</p></div>
    ${guide?.text ? `<div class="fact-row service-public-answer"><span>${confirmed ? '当前已确认公开答复' : '当前公开接待指引'}</span><p>${esc(guide.text)}</p></div>` : '<p class="small muted">当前公开问答中无此条目；请先核对对客口径。</p>'}
    <div class="fact-row service-internal-action"><span>内部动作建议</span><p>${esc(item.internalActionSummary)}</p></div>
    <div class="fact-row"><span>责任岗位候选</span><p>${esc(item.roleCandidate)}</p></div>
    <div class="fact-row"><span>整改优先级</span><p>${esc(item.priority)} · 原表建议，尚未形成整改任务</p></div>
    ${sourceMarkup(item.sourceRef)}`;
  const heading = `<span class="service-question-id">${esc(item.id)}</span> ${esc(title)}`;
  return expanded
    ? `<article class="knowledge-item service-card" data-service-id="${esc(item.id)}"><h3>${heading}</h3>${content}</article>`
    : `<details class="knowledge-item service-card" data-service-id="${esc(item.id)}"><summary>${heading}</summary>${content}</details>`;
}

export function serviceDeskMarkup(propertyId, knowledge) {
  if (propertyId !== 'qinghuan-dali') return '';
  return `<section class="service-desk"><p class="notice service-notice">${esc(data.notice)}</p>${phases.map(phase => {
    const items = serviceKnowledge.filter(item => item.phase === phase);
    return `<section class="editor-group service-phase"><h2>${esc(phase)} · ${items.length}问</h2>${items.map(item => merchantCard(item, knowledge)).join('')}</section>`;
  }).join('')}</section>`;
}

export function ticketServiceMarkup(propertyId, ticket, knowledge) {
  if (propertyId !== 'qinghuan-dali') return '';
  const ids = new Set(Array.isArray(ticket?.knowledgeIds) ? ticket.knowledgeIds : []);
  const items = serviceKnowledge.filter(item => ids.has(item.id));
  if (!items.length) return '';
  return `<section class="service-ticket"><h2>本次咨询的内部处置参考</h2><p class="notice service-notice">${esc(data.notice)}</p>${items.map(item => merchantCard(item, knowledge, true)).join('')}</section>`;
}

export function guestHandbookMarkup(propertyId, knowledge) {
  if (propertyId !== 'qinghuan-dali') return '';
  // Use only the caller's current published collection. Deleted or revised
  // answers must never be restored from merchant material or a seed snapshot.
  const guides = [...new Map(publicGuides(knowledge).map(guide => [guide.id, guide])).values()]
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  if (!guides.length) return '<section class="service-handbook"><p class="notice">暂无公开服务指引，请通过订单平台已有的商家联系入口确认。</p></section>';
  return `<section class="service-handbook"><p class="notice service-notice">按入住阶段查找问题。待商家确认的内容不作为本店已提供服务的承诺；联系方式请从订单平台已有的商家联系入口获取。</p>${phases.map(phase => {
    const items = guides.filter(guide => guide.phase === phase);
    if (!items.length) return '';
    return `<section class="editor-group service-phase"><h2>${esc(phase)} · ${items.length}问</h2>${items.map(guide => {
      const confirmed = guide.requiresHuman === false;
      return `<details class="knowledge-item service-guide"><summary><span class="service-question-id">${esc(guide.id)}</span> ${esc(guide.question)}</summary><p class="tag service-status">${confirmed ? '已确认公开答复' : '待商家确认'}</p><p class="service-public-answer">${esc(guide.text)}</p>${confirmed ? '' : `<p class="small service-missing"><strong>待补充：</strong>${esc(publicMissing[guide.id])}</p>`}${publicSourceMarkup(guide)}<button class="text-btn service-ask" data-action="select-guide" data-knowledge="${esc(guide.id)}">就这个问题咨询</button></details>`;
    }).join('')}</section>`;
  }).join('')}</section>`;
}
