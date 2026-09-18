/**
 * 测试库生成器 v2：中文话题库（12 话题 × 6 篇 = 72）+ 干扰笔记（4）+ 英文库（10）+ 压测库（1100+）
 * 输出到 test/vault/
 */

import * as fs from "fs";
import * as path from "path";

const OUT = path.join(__dirname, "vault");

interface Topic {
  name: string;
  /** 手写笔记 3 篇 */
  manual: { title: string; body: string }[];
  /** 关键词池 10 个，用于生成 3 篇变体笔记 */
  keywords: string[];
}

const topics: Topic[] = [
  {
    name: "健康饮食与营养",
    manual: [
      {
        title: "减脂期的蛋白质摄入",
        body: "减脂期间蛋白质的摄入非常关键。每公斤体重建议摄入1.6到2.2克蛋白质，充足的蛋白质可以维持肌肉量，避免基础代谢下降。优质蛋白来源包括鸡胸肉、鸡蛋、鱼虾、豆制品和乳清蛋白。饮食中还要注意控制热量缺口，不要过度节食，否则容易流失肌肉。搭配足够的蔬菜和膳食纤维，饱腹感会更强。",
      },
      {
        title: "一周减脂餐单记录",
        body: "本周的减脂餐单：早餐是燕麦加鸡蛋，午餐鸡胸肉配糙米和西兰花，晚餐鱼肉加豆腐。每天热量控制在1500千卡左右，蛋白质大约110克。加餐吃坚果和希腊酸奶。整体感觉饱腹感不错，两周下来体重降了1.2公斤，肌肉没有明显流失。蛋白质和膳食纤维确实是减脂期最重要的营养素。",
      },
      {
        title: "维生素与营养补充笔记",
        body: "日常饮食中容易缺乏的维生素包括维生素D和B族维生素。维生素D主要靠晒太阳合成，冬季或室内工作者容易不足。膳食纤维对肠道健康非常重要，全谷物、豆类和蔬菜是主要来源。补剂只是辅助，营养的核心还是均衡饮食：蛋白质、碳水、脂肪的比例要合理，多吃天然食物。",
      },
    ],
    keywords: ["蛋白质", "热量", "膳食纤维", "维生素", "鸡胸肉", "减脂", "卡路里", "均衡饮食", "营养", "蔬菜"],
  },
  {
    name: "健身与运动训练",
    manual: [
      {
        title: "深蹲动作要点与训练计划",
        body: "深蹲是力量训练之王。要点：双脚与肩同宽，膝盖与脚尖方向一致，下蹲时臀部向后坐，核心收紧，背部保持中立位。每周练两次下肢，每次5组深蹲，每组8到12次。配合硬拉和弓步蹲，臀腿力量提升明显。训练后注意拉伸，补充蛋白质帮助肌肉恢复。",
      },
      {
        title: "有氧运动与体能提升",
        body: "有氧运动包括跑步、游泳、骑车和划船机。提升体能的思路：每周3到4次，每次30到45分钟，心率保持在最大心率的60%到80%。间歇跑对心肺功能提升最有效，比如快跑1分钟慢跑2分钟循环。长期坚持有氧训练，静息心率会下降，耐力明显变好。",
      },
      {
        title: "健身房力量训练记录",
        body: "本周力量训练记录：周一胸肩（卧推、推举），周三背（引体向上、划船），周五腿（深蹲、硬拉）。每次训练前热身10分钟，训练后拉伸。重量循序渐进，大重量动作注意保护。肌肉量和力量的提升需要时间，保持训练频率比单次练到力竭更重要。",
      },
    ],
    keywords: ["深蹲", "力量训练", "有氧", "心率", "肌肉", "拉伸", "训练计划", "体能", "硬拉", "组数"],
  },
  {
    name: "编程与软件开发",
    manual: [
      {
        title: "TypeScript 类型系统笔记",
        body: "TypeScript 的类型系统包括基础类型、接口、泛型和联合类型。接口用来描述对象结构，泛型让函数可以复用多种类型。类型收窄（narrowing）是常用技巧，通过 typeof 和 in 判断缩小类型范围。写代码时尽量让类型明确，避免 any，编译期就能发现大部分错误。",
      },
      {
        title: "前后端接口联调经验",
        body: "前后端联调时接口文档要先行，定义好请求参数和响应结构。常见问题：字段命名不一致、时间格式不统一、错误码没约定。建议用 OpenAPI 规范描述接口，前端生成类型定义。联调环境要稳定，网络代理配置好，遇到 404 先检查路由，500 看后端日志。",
      },
      {
        title: "代码调试与性能优化",
        body: "调试代码的第一步是复现问题，用 console 和断点逐步排查。性能优化要先测量再动手，用 Performance 面板找出瓶颈。常见性能问题：重复渲染、大数组遍历、未缓存的请求。数据库查询要加索引，接口响应做缓存。优化完成后要对比基准数据，确认确实变快。",
      },
    ],
    keywords: ["代码", "接口", "函数", "数据库", "调试", "编译", "类型", "性能", "框架", "日志"],
  },
  {
    name: "历史人物与王朝",
    manual: [
      {
        title: "汉武帝与汉朝鼎盛",
        body: "汉武帝刘彻在位五十余年，是汉朝国力最鼎盛的时期。他北击匈奴，派卫青、霍去病多次出征，打通河西走廊。经济上实行盐铁官营，加强中央集权。晚年也因连年战争导致民生疲惫，引发巫蛊之祸。史书记载他晚年下罪己诏，反思穷兵黩武的过失。",
      },
      {
        title: "唐太宗与贞观之治",
        body: "唐太宗李世民开创了贞观之治。他吸取隋亡教训，虚心纳谏，重用魏征、房玄龄、杜如晦等贤臣。轻徭薄赋，休养生息，完善三省六部制。贞观年间社会安定，经济恢复，史称路不拾遗、夜不闭户。唐太宗说以铜为镜可以正衣冠，以史为镜可以知兴替。",
      },
      {
        title: "明太祖朱元璋的治国策略",
        body: "明太祖朱元璋出身布衣，建立明朝后推行严厉的治国策略。他废除丞相制度，设立锦衣卫监察百官，严惩贪官。经济上鼓励垦荒，移民屯田，恢复农业生产。他还大封诸王镇守边疆。朱元璋勤政但多疑，晚年兴大狱，株连甚广，对明朝政治生态影响深远。",
      },
    ],
    keywords: ["皇帝", "朝代", "战役", "大臣", "王朝", "史料", "古代", "宫廷", "皇权", "史书"],
  },
  {
    name: "科幻与太空探索",
    manual: [
      {
        title: "星际移民的可能性",
        body: "星际移民是科幻作品永恒的主题。太阳系内，火星是候选目标，但大气稀薄、辐射强、重力低。更远的恒星系统需要超光速或世代飞船。科幻小说里常见的设定包括冬眠舱、人工重力、生态循环系统。真实的星际旅行还面临能源和生命维持的难题，短期内难以实现。",
      },
      {
        title: "外星文明的费米悖论",
        body: "费米悖论：宇宙如此之大，为什么我们还没发现外星文明？可能的解释包括大过滤器理论、动物园假说、文明难以跨越星际距离等。科幻作品经常以此为背景，描写人类与外星文明第一次接触的场景。SETI 项目一直在监听外星信号，但至今没有确凿发现。",
      },
      {
        title: "太空探索里程碑",
        body: "人类太空探索的重要里程碑：1957年斯普特尼克一号入轨，1961年加加林首次进入太空，1969年阿波罗十一号登月。此后是空间站时代，国际空间站持续运行二十年。近年商业航天兴起，猎鹰火箭实现可回收。未来目标是重返月球和登陆火星，太空文明正在一步步变成现实。",
      },
    ],
    keywords: ["宇宙", "星球", "飞船", "外星", "银河", "星际", "太空", "文明", "火星", "轨道"],
  },
  {
    name: "投资理财与资产配置",
    manual: [
      {
        title: "指数基金定投策略",
        body: "指数基金定投是普通人参与投资最稳妥的方式。选择宽基指数如沪深300、标普500，每月固定金额买入，摊平成本。定投的关键是长期坚持，不因短期波动停止。收益率来自市场长期增长和复利效应。仓位控制很重要，不要把所有资产都放在权益类投资上。",
      },
      {
        title: "资产配置与风险管理",
        body: "资产配置决定了投资组合大部分收益。经典做法是股债平衡，根据年龄调整比例，年轻时可以多配股票。分散投资是控制风险的核心，不同资产类别相关性越低越好。还要留足应急资金，一般三到六个月生活开支。定期再平衡，恢复目标比例。",
      },
      {
        title: "股票投资的估值方法",
        body: "股票估值方法主要有市盈率、市净率和现金流折现。市盈率适合盈利稳定的公司，成长股看PEG。估值还要结合行业前景和公司基本面。买入时留出安全边际，避免追高。投资股票的风险远高于基金，要控制单只股票的仓位，做好亏损的心理准备。",
      },
    ],
    keywords: ["投资", "股票", "基金", "收益率", "资产", "风险", "理财", "仓位", "复利", "定投"],
  },
  {
    name: "心理学与情绪管理",
    manual: [
      {
        title: "焦虑情绪的成因与应对",
        body: "焦虑是对未来不确定性的担忧，适度的焦虑有保护作用，过度焦虑则影响生活。常见成因包括压力过大、完美主义、信息过载。应对方法：正念呼吸、规律运动、减少刷手机时间、把大目标拆成小步骤。如果焦虑持续影响睡眠和日常功能，建议寻求专业心理咨询。",
      },
      {
        title: "正念冥想练习记录",
        body: "正念冥想练习记录：每天早晨冥想十分钟，关注呼吸，念头来了不评判，轻轻拉回注意力。坚持三周后，专注力明显提升，睡前杂念变少。常用的引导方式有身体扫描和呼吸观察。冥想不是清空大脑，而是练习觉察。压力和情绪的调节能力需要持续训练。",
      },
      {
        title: "情绪日记与自我觉察",
        body: "情绪日记帮助识别情绪模式：记录触发事件、身体感受、想法和反应。坚持记录后发现，很多情绪反应来自自动化的负面想法，比如灾难化思维。用认知行为疗法的方法，把想法写下来逐条检验，情绪强度会明显下降。自我觉察是情绪管理的第一步。",
      },
    ],
    keywords: ["心理", "情绪", "焦虑", "压力", "认知", "行为", "潜意识", "成长", "觉察", "正念"],
  },
  {
    name: "旅行与城市漫游",
    manual: [
      {
        title: "京都三日游攻略",
        body: "京都适合慢慢逛。第一天清水寺、二年坂三年坂、祇园，傍晚在鸭川边散步。第二天伏见稻荷大社千本鸟居、宇治抹茶，第三天金阁寺、岚山竹林。交通建议买公交一日券，住宿选京都站附近。避开樱花季和红叶季的人潮，秋季的京都庭院色彩最美。",
      },
      {
        title: "川西自驾行程规划",
        body: "川西自驾经典路线：成都出发，经康定、新都桥、理塘，到稻城亚丁，全程约十天。海拔从五百米升到四千多米，要注意高反，提前吃红景天，行程别太赶。新都桥是摄影天堂，理塘是天空之城。山路弯多，落石路段注意安全，油量提前规划好。",
      },
      {
        title: "城市漫游与在地体验",
        body: "城市漫游的精髓是走进当地生活：逛菜市场、坐公交、在社区咖啡馆坐一下午。旅行不一定要去热门景点，一条老街、一家老字号都可能带来惊喜。出发前查一下当地节庆，赶上庙会或市集是难得的体验。酒店选在老城区，晚上步行就能感受城市的另一面。",
      },
    ],
    keywords: ["旅行", "城市", "景点", "机票", "酒店", "行程", "攻略", "目的地", "自驾", "民宿"],
  },
  {
    name: "摄影与光影构图",
    manual: [
      {
        title: "光圈快门感光度基础",
        body: "摄影曝光三要素：光圈、快门、感光度。光圈控制进光量和景深，大光圈背景虚化。快门凝固或虚化运动，高速快门拍运动，慢门拍车流光轨。感光度越高噪点越多。三者互相制约，理解曝光三角是摄影入门的第一步，先学会用光圈优先模式。",
      },
      {
        title: "自然光人像拍摄技巧",
        body: "自然光人像的关键是光线方向和质感。黄金时段是日出后和日落前一小时，光线柔和带暖色。逆光拍摄可以拍出轮廓光，注意补光避免脸部太暗。多云天气的光线均匀，适合拍人像。构图用三分法，眼睛对焦要准，背景简洁不干扰主体。",
      },
      {
        title: "街头摄影的构图心得",
        body: "街头摄影讲究瞬间和构图。常用技巧：等待决定性瞬间，利用光影对比、引导线、框架构图。街拍时保持低调，用长焦或盲拍捕捉自然状态。黑白照片适合突出光影和形状。后期只做基础调整，好的街拍照片靠的是观察力而不是后期。",
      },
    ],
    keywords: ["摄影", "相机", "镜头", "光圈", "快门", "光线", "构图", "画质", "对焦", "曝光"],
  },
  {
    name: "音乐与乐器演奏",
    manual: [
      {
        title: "吉他初学者练习计划",
        body: "吉他入门先练和弦转换：C、G、Am、Em、F这几个开放和弦。每天练习半小时，重点是慢速准确再提速。爬格子练习手指灵活度，节拍器从60拍开始。学几首简单的弹唱曲目增加成就感。手指起茧是正常过程，坚持两个月就能弹唱大部分流行歌。",
      },
      {
        title: "钢琴即兴伴奏入门",
        body: "钢琴即兴伴奏从和弦进行开始：常用卡农进行、1645进行。左手弹根音和五度，右手和弦加旋律。多听原曲分析伴奏织体，柱式和弦和分解和弦交替使用。即兴的关键是耳朵训练，唱出旋律再在琴上找音。坚持每天扒一首歌的和弦。",
      },
      {
        title: "编曲中的音色与混音",
        body: "编曲要注重音色层次：低音区放贝斯和底鼓，中音区放人声和主旋律，高音区放镲片和点缀。混音时先做音量平衡，再处理频率冲突，EQ 避免乐器打架。压缩让动态更稳定，混响创造空间感。参考喜欢的作品对比自己的混音，耳朵是最终标准。",
      },
    ],
    keywords: ["音乐", "乐器", "旋律", "和弦", "吉他", "钢琴", "节奏", "演奏", "音色", "节拍"],
  },
  {
    name: "育儿与家庭教育",
    manual: [
      {
        title: "孩子专注力的培养",
        body: "培养孩子专注力，环境比说教重要。给孩子一个安静整洁的书桌，一次只做一件事。番茄钟法适合大一点的孩子，25分钟专注加5分钟休息。家长陪伴时不要频繁打断，等孩子主动求助再介入。电子屏幕要控制时间，户外运动对注意力恢复很有帮助。",
      },
      {
        title: "亲子阅读的方法与习惯",
        body: "亲子阅读从绘本开始，每天固定时间共读二十分钟。读书时多提问互动，让孩子预测情节、描述画面。指读可以帮孩子建立文字意识。选书要符合年龄，兴趣优先。阅读习惯的养成靠坚持，家里要有随手可拿的书。孩子爱读书，语文能力自然提升。",
      },
      {
        title: "幼小衔接的家庭准备",
        body: "幼小衔接最重要的是习惯和心态，不是提前学小学知识。培养作息规律，练习整理书包和文具，学会表达需求和遵守规则。数学启蒙藏在生活里，认数字、数数、比较多少。拼音可以适当接触但不强求。多带孩子参加集体活动，适应课堂节奏。",
      },
    ],
    keywords: ["孩子", "教育", "学习", "习惯", "家长", "课堂", "考试", "陪伴", "阅读", "成长"],
  },
  {
    name: "咖啡文化与手冲",
    manual: [
      {
        title: "手冲咖啡入门笔记",
        body: "手冲咖啡的参数：粉水比1比15，水温88到93度，研磨度中等偏细。注水方式：先闷蒸30秒让咖啡粉排气，再分段注水。滤纸要先润湿贴合滤杯。冲出来的咖啡要有平衡的酸度和甜感。器具选择 V60 或蛋糕杯都行，关键在于稳定的手法和新鲜烘焙的豆子。",
      },
      {
        title: "咖啡豆品种与烘焙度",
        body: "咖啡豆主要分阿拉比卡和罗布斯塔，精品咖啡基本都是阿拉比卡。烘焙度影响风味：浅烘保留花果酸香，中烘平衡，深烘焦糖和苦感重。产地风味：埃塞俄比亚的花香、哥伦比亚的坚果、巴西的巧克力。买豆子要看烘焙日期，新鲜度比价格更重要。",
      },
      {
        title: "意式浓缩与奶咖",
        body: "意式浓缩是奶咖的基础，萃取参数：18克粉出36克液，25到30秒。压粉要平整，布粉均匀。拿铁用双份浓缩加蒸奶，奶泡要绵密细腻，打出微甜的口感。拉花是锦上添花，先练好奶泡质量。家庭咖啡机虽然不如商用机，掌握参数也能做出不错的拿铁。",
      },
    ],
    keywords: ["咖啡", "豆子", "烘焙", "萃取", "风味", "研磨", "手冲", "拿铁", "浓缩", "奶泡"],
  },
];

/* 跨话题干扰笔记（不参与准确率计算） */
const outliers: { title: string; body: string }[] = [
  { title: "本周购物清单", body: "周末去超市采购：牛奶、面包、鸡蛋、洗发水、洗衣液，顺便买了两个收纳盒。家里日用品快用完了，这个月预算控制得还可以。下周要记得交水电费，还有一个快递没取。整理了一下冰箱，过期的东西都扔掉了。" },
  { title: "朋友聚会安排", body: "周六晚上约了老同学吃饭，订了常去的那家川菜馆。大家好久没见了，聊聊近况。饭后想去唱K，或者找个地方喝点东西。老李最近换工作了，小王搬了新家。下次聚会可以安排一次郊游，带家属一起。" },
  { title: "年度目标与复盘", body: "今年年初定了几个目标：读书、存钱、健身、学一门新技能。到年中复盘：书读了八本，存钱进度70%，健身坚持了三个月后中断，新技能学了点皮毛。下半年调整计划，目标精简，把健身重新排上日程，存钱继续保持。" },
  { title: "软件使用小技巧", body: "最近发现的几个软件技巧：截图工具可以滚动截长图，笔记软件支持双向链接，输入法可以自定义短语。浏览器插件能屏蔽广告，密码管理器自动填充。这些小工具组合起来，日常工作效率提升不少，值得继续挖掘。" },
];

/* ---------- 英文退化检测笔记（10篇） ---------- */

const enNotes: { title: string; body: string }[] = [
  { title: "Morning Routine for Productivity", body: "A consistent morning routine improves focus. Wake up early, drink water, do light exercise, and plan the day's top three tasks. Avoid checking your phone during the first hour." },
  { title: "Time Blocking Method", body: "Time blocking assigns specific hours to specific tasks on your calendar. Batch similar work together, schedule deep work in the morning, and leave buffer time between blocks. Review the plan each evening." },
  { title: "Habit Stacking Guide", body: "Habit stacking links a new habit to an existing one. After making coffee, write three journal lines. After brushing teeth, do ten push-ups. Small habits compound into big changes over months." },
  { title: "Pomodoro Technique Notes", body: "The Pomodoro technique splits work into 25-minute focus sessions with 5-minute breaks. After four pomodoros, take a longer break. It reduces procrastination and keeps energy steady." },
  { title: "Deep Work Strategies", body: "Deep work means focusing without distraction on cognitively demanding tasks. Schedule it in blocks, turn off notifications, and protect the time aggressively. Shallow work can wait." },
  { title: "Minimalist Desk Setup", body: "A minimalist desk has only essentials: laptop, monitor, keyboard, lamp, and a plant. Fewer objects mean fewer distractions. Cable management and good lighting make the space pleasant." },
  { title: "Reading Habit Tracker", body: "Track reading with a simple log: date, book, pages read. Aim for 20 pages a day. Carry a book everywhere, replace phone scrolling with reading during commutes." },
  { title: "Note-Taking Systems Compared", body: "Zettelkasten links atomic notes with IDs. PARA organizes by Projects, Areas, Resources, Archives. Choose one system and stick with it. A simple system used daily beats a complex one abandoned." },
  { title: "Digital Declutter Week", body: "Spend one week removing digital clutter: unsubscribe from newsletters, delete unused apps, organize desktop files, and archive old notes. A clean digital space reduces stress." },
  { title: "Weekly Review Template", body: "A weekly review takes 30 minutes: check the calendar, clear inboxes, review goals, and plan next week. Do it every Friday afternoon. It keeps projects moving without losing track." },
  { title: "Getting Things Done in Practice", body: "GTD is a five-step productivity system: capture everything into an inbox, clarify what each item means, organize into lists, review regularly, and execute next actions. The key is getting everything out of your head and trusting the system." },
  { title: "Kanban Board for Personal Tasks", body: "A personal kanban board has three columns: backlog, in progress, done. Limit work in progress to two or three items. Move cards only when you actually start them. Visualizing tasks reduces mental load and makes priorities obvious." },
  { title: "Inbox Zero Workflow", body: "Inbox zero means processing email quickly: delete, delegate, respond, or archive. Batch inbox processing twice a day instead of reacting all day. The goal is not an empty inbox but a fast triage habit that keeps attention free." },
];

/* ---------- 压测库生成器（40 话题 × 28 篇 ≈ 1120 篇） ---------- */

const STRESS_TOPICS: { name: string; words: string[] }[] = [
  { name: "智能家居", words: ["智能家居", "传感器", "网关", "语音控制", "自动化场景", "物联网", "家庭网络", "设备联动", "APP", "智能音箱"] },
  { name: "新能源汽车", words: ["新能源汽车", "电池", "续航", "充电桩", "电驱", "动能回收", "锂电", "快充", "能耗", "自动驾驶"] },
  { name: "跨境电商", words: ["跨境电商", "物流", "海外仓", "关税", "选品", "平台规则", "支付", "汇率", "退货率", "供应链"] },
  { name: "短视频运营", words: ["短视频", "流量", "完播率", "选题", "脚本", "投流", "涨粉", "评论区", "算法推荐", "带货"] },
  { name: "睡眠科学", words: ["睡眠", "深睡", "生物钟", "褪黑素", "卧室环境", "睡前习惯", "午睡", "打鼾", "睡眠周期", "失眠"] },
  { name: "中医养生", words: ["中医", "体质", "气血", "穴位", "艾灸", "食疗", "经络", "湿气", "阴阳", "脾胃"] },
  { name: "宠物养护", words: ["宠物", "猫", "狗", "疫苗", "驱虫", "猫粮", "遛狗", "绝育", "宠物医院", "训练"] },
  { name: "家庭园艺", words: ["园艺", "盆栽", "月季", "多肉", "施肥", "浇水", "土壤", "光照", "病虫害", "阳台"] },
  { name: "钓鱼技巧", words: ["钓鱼", "鱼竿", "饵料", "鱼线", "浮漂", "打窝", "鲫鱼", "夜钓", "水库", "调漂"] },
  { name: "户外露营", words: ["露营", "帐篷", "睡袋", "营地", "篝火", "炉具", "防潮垫", "头灯", "徒步", "户外装备"] },
  { name: "茶文化", words: ["茶叶", "茶艺", "绿茶", "普洱", "紫砂壶", "茶席", "回甘", "功夫茶", "茶香", "发酵"] },
  { name: "书法练习", words: ["书法", "毛笔", "临帖", "楷书", "行书", "宣纸", "墨汁", "笔法", "章法", "碑帖"] },
  { name: "桌游聚会", words: ["桌游", "剧本杀", "狼人杀", "卡牌", "策略", "桌游店", "推理", "聚会", "规则", "阵营"] },
  { name: "健身房管理", words: ["健身房", "私教", "会员", "团课", "器械", "运营", "续卡", "体测", "教练", "门店"] },
  { name: "会计实务", words: ["会计", "记账", "凭证", "报表", "税务", "增值税", "折旧", "审计", "科目", "汇算清缴"] },
  { name: "法律常识", words: ["法律", "合同", "诉讼", "劳动法", "仲裁", "违约金", "证据", "律师", "民法典", "维权"] },
  { name: "保险规划", words: ["保险", "重疾险", "医疗险", "寿险", "年金", "保额", "免赔额", "理赔", "投保", "保障"] },
  { name: "装修避坑", words: ["装修", "水电", "瓷砖", "油漆", "定制柜", "预算", "监理", "甲醛", "户型", "验收"] },
  { name: "母婴护理", words: ["母婴", "母乳", "奶粉", "辅食", "纸尿裤", "婴儿床", "拍嗝", "疫苗", "湿疹", "月嫂"] },
  { name: "汽车保养", words: ["汽车保养", "机油", "轮胎", "刹车片", "滤芯", "保养周期", "积碳", "电瓶", "四轮定位", "年检"] },
  { name: "吉他弹唱", words: ["吉他", "弹唱", "和弦", "扫弦", "变调夹", "指弹", "节拍器", "练琴", "音阶", "扒谱"] },
  { name: "减脂餐", words: ["减脂餐", "热量", "鸡胸肉", "沙拉", "代餐", "轻食", "碳水", "蛋白质", "饱腹", "低卡"] },
  { name: "滑雪入门", words: ["滑雪", "雪板", "雪场", "犁式", "平行式", "缆车", "护具", "雪季", "粉雪", "教练"] },
  { name: "潜水考证", words: ["潜水", "OW", "中性浮力", "气瓶", "潜点", "珊瑚", "面镜", "脚蹼", "减压", "潜水日志"] },
  { name: "粤菜烹饪", words: ["粤菜", "蒸鱼", "煲汤", "白切鸡", "镬气", "姜葱", "烧腊", "砂锅", "火候", "豉油"] },
  { name: "烘焙入门", words: ["烘焙", "烤箱", "面团", "发酵", "黄油", "蛋糕", "曲奇", "温度", "翻面", "裱花"] },
  { name: "股票技术分析", words: ["K线", "均线", "MACD", "成交量", "支撑位", "突破", "回调", "止损", "趋势线", "背离"] },
  { name: "语言学习", words: ["语言学习", "词汇量", "听力", "口语", "精读", "影子跟读", "艾宾浩斯", "背单词", "语感", "沉浸"] },
  { name: "极简生活", words: ["极简", "断舍离", "收纳", "减少物欲", "整理", "囤积", "消耗品", "极简主义", "清理", "空间"] },
  { name: "冥想正念", words: ["冥想", "正念", "呼吸", "觉察", "打坐", "念头", "禅修", "身体扫描", "静观", "专注"] },
  { name: "汽车改装", words: ["改装", "避震", "轮毂", "排气", "刷程序", "刹车", "包围", "赛道", "马力", "底盘"] },
  { name: "无人机航拍", words: ["无人机", "航拍", "云台", "电池", "图传", "禁飞区", "构图", "延时", "炸机", "飞行执照"] },
  { name: "古典音乐", words: ["古典音乐", "交响乐", "奏鸣曲", "指挥", "乐团", "莫扎特", "贝多芬", "乐章", "室内乐", "乐评"] },
  { name: "跑步训练", words: ["跑步", "配速", "步频", "马拉松", "心率", "跑鞋", "乳酸阈值", "长距离", "恢复", "拉伸"] },
  { name: "开源软件", words: ["开源", "许可证", "GitHub", "提交", "PR", "社区", "issue", "fork", "文档", "维护者"] },
  { name: "数据可视化", words: ["可视化", "图表", "D3", "仪表盘", "配色", "坐标轴", "交互", "数据清洗", "报表", "大屏"] },
  { name: "项目管理", words: ["项目管理", "甘特图", "里程碑", "需求", "排期", "风险", "复盘", "迭代", "燃尽图", "干系人"] },
  { name: "直播带货", words: ["直播", "带货", "话术", "场观", "转化率", "选品", "优惠券", "脚本", "复盘", "GMV"] },
  { name: "博物馆参观", words: ["博物馆", "文物", "展厅", "导览", "特展", "青铜器", "书画", "考古", "镇馆之宝", "预约"] },
  { name: "笔记方法论", words: ["笔记", "双链", "卡片盒", "标签", "整理", "知识库", "摘录", "目录", "回顾", "写作"] },
];

function genStressNotes(): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  for (const t of STRESS_TOPICS) {
    for (let i = 1; i <= 28; i++) {
      const picked = [...t.words].sort(() => Math.random() - 0.5).slice(0, 6);
      const body = `【${t.name}】第 ${i} 篇实践记录。${picked.slice(0, 3).join("、")} 是近期重点，${picked[3]} 与 ${picked[4]} 需要持续观察。${picked[5]} 的影响在本周有所体现，我记录了相关数据并做了对比。整体来看，${t.name} 方向的积累正在见效，后续计划围绕 ${picked[1]} 和 ${picked[2]} 继续深入，同时注意 ${picked[4]} 的细节。附：第 ${i} 周小结，指标与上周持平，${picked[0]} 稳定。`;
      out.push({ title: `${t.name}-记录-${i}`, body });
    }
  }
  return out;
}

/* ---------- 生成变体笔记（每话题 3 篇，8 个关键词，句式各异） ---------- */

const TEMPLATES = [
  (t: string, k: string[]) =>
    `关于${t}，最近又有了一些新的体会。${k[0]}和${k[1]}是绕不开的两个核心，${k[2]}的积累决定了${k[3]}能不能做好。我现在的做法是：先把${k[4]}固定下来，再用${k[5]}去验证${k[6]}的效果，最后根据${k[7]}的情况做调整。坚持一段时间，应该能看到明显变化，到时候再回来更新这篇。`,
  (t: string, k: string[]) =>
    `最近在${t}上遇到一个坎：${k[0]}一直不稳定，导致${k[1]}也没跟上。试了几种办法，${k[2]}最有效，${k[3]}其次。记录显示，调整${k[4]}之后，${k[5]}有了改善，${k[6]}保持正常。接下来打算把${k[7]}纳入日常，继续观察一段时间再下结论。`,
  (t: string, k: string[]) =>
    `${t}的下一步计划：第一，继续打磨${k[0]}，目标是把${k[1]}提升到稳定水平；第二，${k[2]}要控制好节奏，不能影响${k[3]}；第三，每周复盘${k[4]}和${k[5]}的数据，与${k[6]}做对比。工具方面，${k[7]}准备长期用下去，养成习惯后自然会出效果。`,
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genTopicNotes(t: Topic): { title: string; body: string }[] {
  const out = [...t.manual];
  for (let i = 0; i < 3; i++) {
    const k = shuffle(t.keywords).slice(0, 8);
    out.push({
      title: `${t.name}·实践笔记${i + 1}`,
      body: TEMPLATES[i](t.name, k),
    });
  }
  return out;
}

/* ---------- 写出测试库 ---------- */

function ensure(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeNote(topicDir: string | null, title: string, body: string): void {
  const dir = topicDir ? path.join(OUT, "中文话题库", topicDir) : path.join(OUT, "英文库");
  ensure(dir);
  const safe = title.replace(/[\\/:*?"<>|]/g, "-");
  fs.writeFileSync(path.join(dir, `${safe}.md`), `# ${title}\n\n${body}\n`);
}

function main(): void {
  fs.rmSync(OUT, { recursive: true, force: true });

  let zhCount = 0;
  for (const t of topics) {
    for (const n of genTopicNotes(t)) {
      writeNote(t.name, n.title, n.body);
      zhCount++;
    }
  }
  for (const n of outliers) writeNote("干扰笔记", n.title, n.body);
  for (const n of enNotes) writeNote(null, n.title, n.body);

  const stress = genStressNotes();
  for (const n of stress) {
    const dir = path.join(OUT, "压测库", n.title.split("-")[0]);
    ensure(dir);
    const safe = n.title.replace(/[\\/:*?"<>|]/g, "-");
    fs.writeFileSync(path.join(dir, `${safe}.md`), `# ${n.title}\n\n${n.body}\n`);
  }

  console.log(`测试库生成完毕：中文话题库 ${zhCount} 篇（12 话题）+ 干扰 ${outliers.length} 篇，英文库 ${enNotes.length} 篇，压测库 ${stress.length} 篇`);
  console.log(`位置：${OUT}`);
}

main();
