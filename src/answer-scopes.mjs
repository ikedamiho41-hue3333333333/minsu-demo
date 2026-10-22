// These are subjects, not proof that an entire FAQ has been answered. A broad
// form field such as “网络与设施” can contain facts about several different ones.
const definitions = [
 ['kitchen','kitchen','厨房使用规则',/厨房|做饭|煮饭|烹饪|锅具|厨具/],
 ['parking','parking','停车说明',/停车|车位|自驾|停哪|泊车/],
 ['charging','parking','充电设施',/充电|电车/],
 ['checkin','checkin','入住与退房',/入住|退房|几点到|提前到|晚到/],
 ['location','location','位置与交通',/地址|在哪|哪里|位置|怎么去|怎么走|导航|路线|楼栋|门牌|入口|门禁|门锁/],
 ['pickup','location','接机与接站',/接机|接站|机场|高铁站|火车站|大理站/],
 ['dropoff','location','叫车与送站',/送站|送机|叫车|拼车/],
 ['public-space','environment','环境与公共区域',/院子|庭院|环境|客厅|公共区/],
 ['photos','environment','实拍与房源对应',/图片|照片|实拍|照骗|景观/],
 ['pests','environment','防虫与除虫',/蜘蛛|蚊虫|蚊子|虫子|驱蚊|除虫/],
 ['cleaning','environment','卫生与保洁',/卫生|打扫|垃圾|保洁|补扫|清洁/],
 ['noise','environment','隔音与噪音',/隔音|噪音|吵|安静|临街|睡不着/],
 ['night-safety','environment','夜间路线与求助',/路灯|夜间|夜里|晚上|半夜|安全|迷路/],
 ['network','wifi','网络设施',/wifi|wi-fi|无线|网络/i],
 ['network-fault','wifi','网络故障处理',/连不上|连接失败|网速|断网|网络.{0,5}(慢|故障|断)/],
 ['climate','wifi','空调与取暖',/空调|取暖|暖气|制热|制冷/],
 ['climate-operation','wifi','空调取暖的操作方法',/(?:空调|取暖|暖气).{0,12}(?:怎么|如何|操作|使用方法|开关)|遥控器|制热模式|制冷模式/],
 ['humidity','wifi','除湿设施',/除湿|雨季|潮湿|很潮|会.{0,2}潮/],
 ['utilities','wifi','水电故障处理',/停水|停电|漏水|水电|电路|没电|触电/],
 ['hotwater','wifi','热水设施',/热水|淋浴|忽冷忽热/],
 ['laundry','wifi','洗衣设施',/洗衣|衣服.{0,5}洗|怎么洗|如何洗/],
 ['drying','wifi','烘干与晾衣',/烘干|晾衣|衣服.{0,5}干不了/],
 ['pets','pets','宠物规则',/宠物|带(?:小)?狗|带猫|狗狗|猫咪|小狗|两只猫/],
 ['breakfast','breakfast','早餐说明',/早餐|早饭|含早/],
 ['barbecue','barbecue','烧烤规则',/烧烤|烤肉/],
 ['accessibility','accessibility','无障碍与通行',/轮椅|无障碍|楼梯|电梯/],
 ['invoice','price','发票办理',/发票|开票|税号/],
 ['deposit','price','押金退还',/押金|保证金/],
 ['cancellation','price','退改规则',/退改|取消订单|取消预订|退款/],
 ['discount','price','老客与优惠',/老客|复购|回头客|优惠|折扣|升房/],
 ['damages','price','损坏赔偿',/损坏|损耗|赔偿|赔钱|赔付|扣费/],
 ['booking','price','价格与预订',/房价|房费|预订|预定|价格/],
 ['nearby','nearby','周边吃喝玩乐',/周边|附近|餐厅|景点|吃什么|去哪玩|攻略|唐卡/],
 ['crib',null,'婴儿床',/婴儿床|宝宝床|儿童床/],
 ['extra-bed',null,'加床服务',/加床|折叠床/]
].map(([id,key,label,pattern])=>({id,key,label,pattern}));
const byId = new Map(definitions.map(scope=>[scope.id,scope]));

export function requestedScopes(text) {
 const value=String(text??'').normalize('NFKC').toLowerCase();
 const result=definitions.filter(scope=>scope.pattern.test(value)).map(scope=>scope.id);
 // A connectivity fault is more specific than simply the presence of WiFi.
 if(result.includes('network-fault')&&result.includes('network')&&!/密码|凭据|网络名称|有.{0,4}(wifi|无线)/i.test(value))result.splice(result.indexOf('network'),1);
 if(result.includes('climate-operation')&&result.includes('climate')&&!/有(?:没有|无)?.{0,3}(?:空调|取暖|暖气)|配有/.test(value))result.splice(result.indexOf('climate'),1);
 const roomText=value.replace(/婴儿床|宝宝床|儿童床|加床|折叠床|宠物.{0,3}上床/g,'');
 if(/房间|房型|床|卫浴|浴室|几人|几个人|住几|面积|楼层|几楼|卧室/.test(roomText))result.push('room');
 return new Set(result);
}

export const scopeLabel=id=>byId.get(id)?.label||(id==='room'?'房间配置与面积':'这个问题');
export const scopeKey=id=>byId.get(id)?.key??null;
export function factScopes(key,text) {
 const scopes=new Set([...requestedScopes(text)].filter(id=>scopeKey(id)===key));
 if(scopes.has('climate-operation'))scopes.add('climate');
 if(scopes.has('network-fault'))scopes.add('network');
 // Dedicated fields retain their subject even when a merchant writes only the
 // value (e.g. opening hours). Broad facility fields need an explicit subject.
 const defaults={kitchen:'kitchen',parking:'parking',checkin:'checkin',location:'location',pets:'pets',breakfast:'breakfast',barbecue:'barbecue',accessibility:'accessibility',nearby:'nearby'};
 if(!scopes.size&&defaults[key])scopes.add(defaults[key]);
 return scopes;
}
export const intersection=(a,b)=>new Set([...a].filter(value=>b.has(value)));
export const difference=(a,b)=>new Set([...a].filter(value=>!b.has(value)));
export function relevantFacts(p,scopes,keys=null) {
 return Object.entries(p.facts).filter(([key,fact])=>fact?.text?.trim()&&(!keys||keys.includes(key)))
  .map(([key,fact])=>({key,text:fact.text,scopes:factScopes(key,fact.text)}))
  .filter(fact=>intersection(fact.scopes,scopes).size);
}

export function configurationQuestion(question) {
 const text=String(question);
 if(/(?:原有|既有|现有|原本).{0,12}(?:\d+(?:\.\d+)?米|双床|大床|单人床|床型)/.test(text))return true;
 const clauses=text.split(/[。！？?!，,；;\n]/);
 // A size attached to an added/infant bed describes that service, not a
 // contradictory assertion about the existing beds in a selected room.
 const value=clauses.filter(clause=>!/婴儿床|宝宝床|儿童床|加床|折叠床|宠物.{0,3}上床/.test(clause)).join('；');
 return /床.{0,4}(多大|多宽|宽度|尺寸|几米|多少米)|几张床|床型|床宽|双床|大床|单人床|\d+(?:\.\d+)?米|几间卧室|多少.{0,2}卧室|几人|几个人|住几|人数|面积|楼层|几楼|卫浴|单独出租|按间出租|分开租/.test(value);
}

// Keep general precautions from the published guide when facts answer only a
// part of it. These sentences are copied verbatim, never generated as policy.
export function precautions(text) {
 return (String(text).match(/[^。！？?!]+[。！？?!]?/g)||[])
  .filter(sentence=>/远离危险|不要自行拆修|紧急救援|不徒手接触|先停止使用|先到明亮/.test(sentence))
  .join('');
}
