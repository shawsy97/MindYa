// src/scales/scaleBank.js

const OPTIONS_0_3 = [
  { label: "完全不符合", value: 0 },
  { label: "有时符合", value: 1 },
  { label: "经常符合", value: 2 },
  { label: "总是符合", value: 3 },
];
const OPTIONS_PHQ9 = [
  { label: "完全不会", value: 0 },
  { label: "偶尔几天", value: 1 },
  { label: "一半以上的日子", value: 2 },
  { label: "几乎每天", value: 3 },
];

function assertAllAnswered(scale, answers) {
  const missing = scale.items.filter((it) => answers[it.key] === undefined);
  if (missing.length) {
    throw new Error(`还有 ${missing.length} 题未作答（例如：${missing[0].key}）`);
  }
}

// DASS-21 分级（标准常用阈值）
function levelDep(v) {
  if (v <= 9) return "正常";
  if (v <= 13) return "轻度";
  if (v <= 20) return "中度";
  if (v <= 27) return "重度";
  return "极重度";
}
function levelAnx(v) {
  if (v <= 7) return "正常";
  if (v <= 9) return "轻度";
  if (v <= 14) return "中度";
  if (v <= 19) return "重度";
  return "极重度";
}
function levelStress(v) {
  if (v <= 14) return "正常";
  if (v <= 18) return "轻度";
  if (v <= 25) return "中度";
  if (v <= 33) return "重度";
  return "极重度";
}

function scoreDASS21(scale, answers) {
  assertAllAnswered(scale, answers);

  const raw = { depression: 0, anxiety: 0, stress: 0 };
  for (const it of scale.items) {
    raw[it.sub] += Number(answers[it.key]);
  }

  const score = {
    depression: raw.depression * 2,
    anxiety: raw.anxiety * 2,
    stress: raw.stress * 2,
  };

  const level = {
    depression: levelDep(score.depression),
    anxiety: levelAnx(score.anxiety),
    stress: levelStress(score.stress),
  };

  // 风险标记：你可以后续改规则
  const flags = {
    riskLevel:
      level.depression === "重度" || level.depression === "极重度"
        ? "medium"
        : "low",
  };

  return { raw, score, level, flags };
}

export const SCALE_BANK = {
  DASS21: {
    id: "DASS21",
    name: "DASS-21 抑郁焦虑压力量表",
    period: "过去一周",
    type: "likert",
    ageRange: { min: 12, max: 18 },
    intro: {
      title: "DASS-21 抑郁焦虑压力量表",
      prompt: "最近一周的情绪更像什么天气？没有对错，只选最接近你的感受。",
      paragraphs: [
        "请仔细阅读以下每个条目，并根据过去一周的情况，在每个条目中选择适用于你情况的程度选项。",
        "请回答每个条目，选择没有对错之分。",
      ],
    },
    options: OPTIONS_0_3,
    items: [
      // Stress
      { key: "q1", text: "我觉得很难让自己安静下来。", sub: "stress" },
      { key: "q6", text: "我对事情反应过度。", sub: "stress" },
      { key: "q8", text: "我觉得自己消耗了很多精力。", sub: "stress" },
      { key: "q11", text: "我发现自己变得容易激动。", sub: "stress" },
      { key: "q12", text: "我觉得自己很难放松。", sub: "stress" },
      { key: "q14", text: "我无法忍受任何阻碍我继续做事情的事。", sub: "stress" },
      { key: "q18", text: "我觉得自己容易生气。", sub: "stress" },

      // Anxiety
      { key: "q2", text: "我觉得口干。", sub: "anxiety" },
      { key: "q4", text: "我感到呼吸困难。", sub: "anxiety" },
      { key: "q7", text: "我感到颤抖。", sub: "anxiety" },
      { key: "q9", text: "我担心自己可能会恐慌或出丑。", sub: "anxiety" },
      { key: "q15", text: "我感到快要恐慌了。", sub: "anxiety" },
      { key: "q19", text: "我察觉到心跳加速。", sub: "anxiety" },
      { key: "q20", text: "我无缘无故地感到害怕。", sub: "anxiety" },

      // Depression
      { key: "q3", text: "我无法体验到积极的感受。", sub: "depression" },
      { key: "q5", text: "我对做事情缺乏主动性。", sub: "depression" },
      { key: "q10", text: "我觉得没有什么值得期待。", sub: "depression" },
      { key: "q13", text: "我感到情绪低落、沮丧。", sub: "depression" },
      { key: "q16", text: "我对任何事情都提不起兴趣。", sub: "depression" },
      { key: "q17", text: "我觉得自己一无是处。", sub: "depression" },
      { key: "q21", text: "我觉得生活没有意义。", sub: "depression" },
    ],
    score: (answers) => scoreDASS21(SCALE_BANK.DASS21, answers),
    interpret: (res) => ([
      `抑郁：${res.score.depression}（${res.level.depression}）`,
      `焦虑：${res.score.anxiety}（${res.level.anxiety}）`,
      `压力：${res.score.stress}（${res.level.stress}）`,
    ]),
  },
  PHQ9_CHILD: {
    id: "PHQ9_CHILD",
    name: "PHQ-9 抑郁量表",
    period: "过去 1 周",
    type: "likert",
    ageRange: { min: 8, max: 11 },
    intro: {
      title: "PHQ-9 抑郁量表",
      prompt: "请根据过去 1 周的真实感受作答。",
      paragraphs: [
        "每题请选择最符合你情况的选项。",
        "第 9 题涉及自伤/轻生想法，需要特别关注。",
      ],
    },
    options: OPTIONS_PHQ9,
    items: [
      { key: "p1", text: "做事时提不起劲或没有兴趣。" },
      { key: "p2", text: "感到心情低落、沮丧或绝望。" },
      { key: "p3", text: "入睡困难、睡不安或睡眠较多。" },
      { key: "p4", text: "感觉疲倦或没有活力。" },
      { key: "p5", text: "食欲不振或吃太多。" },
      { key: "p6", text: "觉得自己很糟或觉得自己很失败，或让自己或家人失望。" },
      { key: "p7", text: "对事物专注有困难，例如阅读报纸或看电视时。" },
      { key: "p8", text: "动作或说话速度缓慢到别人已察觉？或正好相反——烦躁或坐立不安，动来动去的情况更胜于平常。" },
      { key: "p9", text: "有不如死掉或用某种方式伤害自己的念头。" },
    ],
    score: (answers) => {
      assertAllAnswered(SCALE_BANK.PHQ9_CHILD, answers);
      const total = Object.values(answers).reduce((sum, v) => sum + Number(v), 0);
      const item9 = Number(answers.p9);
      let level = "轻微";
      if (total <= 4) level = "无或极轻";
      else if (total <= 9) level = "轻度";
      else if (total <= 14) level = "中度";
      else if (total <= 19) level = "中重度";
      else level = "重度";
      const flags = {
        riskLevel: item9 > 0 ? "high" : total >= 15 ? "medium" : "low",
        item9Concern: item9 > 0,
      };
      return { score: { total, item9 }, level: { severity: level }, flags };
    },
    interpret: (res) => {
      const lines = [
        `总分：${res.score.total}`,
        `严重度：${res.level.severity}`,
      ];
      if (res?.flags?.item9Concern) {
        lines.push("第 9 题提示需要单独关注，建议及时寻求支持。");
      }
      return lines;
    },
  },
  SRSS: {
    id: "SRSS",
    name: "睡眠量表（SRSS）",
    period: "近 1 个月内",
    type: "likert",
    ageRange: { min: 12, max: 18 },
    intro: {
      title: "睡眠量表（SRSS）",
      prompt: "最近的睡眠怎么样？入睡、醒来、精力恢复情况如何？",
      paragraphs: [
        "以下问题是了解你睡眠情况的，请在最符合自己的每个问题上选择一个答案（√）。",
        "时间限定在近 1 个月内。",
      ],
    },
    // 这里放一个默认 options（兜底），但 SRSS 我们主要用 item.options
    options: [
      { label: "①", value: 1 },
      { label: "②", value: 2 },
      { label: "③", value: 3 },
      { label: "④", value: 4 },
      { label: "⑤", value: 5 },
    ],
    items: [
      {
        key: "s1",
        text: "近 1 个月内，您觉得平时睡眠足够吗?",
        options: [
          { label: "睡眠过多了", value: 1 },
          { label: "睡眠正好", value: 2 },
          { label: "睡眠欠一些", value: 3 },
          { label: "睡眠不够", value: 4 },
          { label: "睡眠时间远远不够", value: 5 },
        ],
      },
      {
        key: "s2",
        text: "近 1 个月内，您在睡眠后是否已觉得充分休息过了?",
        options: [
          { label: "觉得充分休息过了", value: 1 },
          { label: "觉得休息过了", value: 2 },
          { label: "觉得休息了一点", value: 3 },
          { label: "不觉得休息过了", value: 4 },
          { label: "觉得一点儿也没休息", value: 5 },
        ],
      },
      {
        key: "s3",
        text: "近 1 个月内，您晚上已睡过觉,白天是否打瞌睡?",
        options: [
          { label: "0～5天", value: 1 },
          { label: "很少 (6～12天)", value: 2 },
          { label: "有时 (13～18天)", value: 3 },
          { label: "经常 (19～24天)", value: 4 },
          { label: "总是 (25～31天)", value: 5 },
        ],
      },
      {
        key: "s4",
        text: "近 1 个月内，您平均每个晚上大约能睡几小时?",
        options: [
          { label: "≥9小时", value: 1 },
          { label: "7～8小时", value: 2 },
          { label: "5～6小时", value: 3 },
          { label: "3～4小时", value: 4 },
          { label: "1～2小时", value: 5 },
        ],
      },
      {
        key: "s5",
        text: "近 1 个月内，您是否有入睡困难?",
        options: [
          { label: "0～5天", value: 1 },
          { label: "很少 (6～12天)", value: 2 },
          { label: "有时 (13～18天)", value: 3 },
          { label: "经常 (19～24天)", value: 4 },
          { label: "总是 (25～31天)", value: 5 },
        ],
      },
      {
        key: "s6",
        text: "近 1 个月内，您入睡后中间是否易醒?",
        options: [
          { label: "0～5天", value: 1 },
          { label: "很少 (6～12天)", value: 2 },
          { label: "有时 (13～18天)", value: 3 },
          { label: "经常 (19～24天)", value: 4 },
          { label: "总是 (25～31天)", value: 5 },
        ],
      },
      {
        key: "s7",
        text: "近 1 个月内，您在醒后是否难于再入睡?",
        options: [
          { label: "0～5天", value: 1 },
          { label: "很少 (6～12天)", value: 2 },
          { label: "有时 (13～18天)", value: 3 },
          { label: "经常 (19～24天)", value: 4 },
          { label: "总是 (25～31天)", value: 5 },
        ],
      },
      {
        key: "s8",
        text: "近 1 个月内，您是否多梦或常被恶梦惊醒?",
        options: [
          { label: "0～5天", value: 1 },
          { label: "很少 (6～12天)", value: 2 },
          { label: "有时 (13～18天)", value: 3 },
          { label: "经常 (19～24天)", value: 4 },
          { label: "总是 (25～31天)", value: 5 },
        ],
      },
      {
        key: "s9",
        text: "近 1 个月内，为了睡眠 ,您是否吃安眠药?",
        options: [
          { label: "0～5天", value: 1 },
          { label: "很少 (6～12天)", value: 2 },
          { label: "有时 (13～18天)", value: 3 },
          { label: "经常 (19～24天)", value: 4 },
          { label: "总是 (25～31天)", value: 5 },
        ],
      },
      {
        key: "s10",
        text: "近 1 个月内，您失眠后心情 (心境)如何?",
        options: [
          { label: "无不适", value: 1 },
          { label: "无所谓", value: 2 },
          { label: "有时心烦、急躁", value: 3 },
          { label: "心慌、气短", value: 4 },
          { label: "乏力、没精神、做事效率低", value: 5 },
        ],
      },
    ],

    score: (answers) => {
      assertAllAnswered(SCALE_BANK.SRSS, answers);

      const keys = SCALE_BANK.SRSS.items.map((i) => i.key);
      const total = keys.reduce((acc, k) => acc + Number(answers[k]), 0);

      let level = "睡眠质量正常";
      let riskLevel = "low";
      if (total >= 40) {
        level = "重度睡眠障碍";
        riskLevel = "high";
      } else if (total >= 30) {
        level = "中度睡眠障碍";
        riskLevel = "high";
      } else if (total >= 23) {
        level = "轻度睡眠障碍";
        riskLevel = "medium";
      }

      return {
        score: { total, range: "10-50" },
        level: { total: level },
        flags: { riskLevel },
      };
    },

    interpret: (res) => [
      `总分：${res.score.total}（范围 ${res.score.range}，分数越高表示睡眠问题越多）`,
      `评估时间范围：近 1 个月内`,
    ],
  },
  ERQ: {
    id: "ERQ",
    name: "情绪调节（ERQ）",
    period: "一般情况",
    type: "likert",
    ageRange: { min: 12, max: 18 },
    intro: {
      title: "情绪调节（ERQ）",
      prompt: "当不开心或生气时，你通常会怎么做？每个人都有不同的方式。",
      paragraphs: [
        "在这一部分，我们将有一些关于你的情绪生活的问题要问你，尤其是你如何控制（这指的是调节与管理）你的情绪。",
        "我们感兴趣的是你的情绪生活的两部分内容。一部分是你的情绪体验，或者说是你内心的感受是什么；另一部分是你的情绪表达，或者说是你如何用言语、姿势或者行为等方式来表达情绪。",
        "虽然一些问题看起来和其他问题类似，但它们却有相当程度的不同。对下面两页的每一项表述，请在每一个表述对应的等级上表明你赞同或者不赞同的水平。",
      ],
      image: "erq-scale.png",
    },
    options: [
      { label: "完全不同意", value: 1 },
      { label: "很不同意", value: 2 },
      { label: "有点不同意", value: 3 },
      { label: "中性", value: 4 },
      { label: "有点同意", value: 5 },
      { label: "很同意", value: 6 },
      { label: "完全同意", value: 7 },
    ],
    items: [
      { key: "e1", text: "当我想感受一些积极的情绪（如快乐或高兴）时，我会改变自己思考问题的角度", sub: "reappraisal" },
      { key: "e2", text: "我不会表露自己的情绪", sub: "suppression" },
      { key: "e3", text: "当我想少感受一些消极的情绪（如悲伤或愤怒）时，我会改变自己思考问题的角度", sub: "reappraisal" },
      { key: "e4", text: "当感受到积极情绪时，我会很小心的不让它们表露出来", sub: "suppression" },
      { key: "e5", text: "在面对压力情境时，我会使自己以一种有助于保持平静的方式来考虑它", sub: "reappraisal" },
      { key: "e6", text: "我控制自己情绪的方式是不表达它们", sub: "suppression" },
      { key: "e7", text: "当我想多感受一些积极的情绪时，我会改变自己对情境的考虑方式", sub: "reappraisal" },
      { key: "e8", text: "我会通过改变对情境的考虑方式来控制自己的情绪", sub: "reappraisal" },
      { key: "e9", text: "当感受到消极的情绪时，我确定不会表露它们", sub: "suppression" },
      { key: "e10", text: "当我想少感受一些消极的情绪时，我会改变自己对情境的考虑方式", sub: "reappraisal" },
    ],

    score: (answers) => {
      // 复用你文件里已有的 assertAllAnswered
      assertAllAnswered(SCALE_BANK.ERQ, answers);

      // 分组
      const reKeys = ["e1", "e3", "e5", "e7", "e8", "e10"];
      const supKeys = ["e2", "e4", "e6", "e9"];

      const reSum = reKeys.reduce((acc, k) => acc + Number(answers[k]), 0);
      const supSum = supKeys.reduce((acc, k) => acc + Number(answers[k]), 0);

      const reMean = Number((reSum / reKeys.length).toFixed(2));
      const supMean = Number((supSum / supKeys.length).toFixed(2));

      // 不做“高低好坏”的医学判断，只输出策略倾向
      let strategy = "比较均衡";
      let summary = "你对情绪的处理方式比较灵活，会在不同情境下做出调整。";
      if (reMean > supMean) {
        strategy = "更偏向认知重评";
        summary = "你更习惯换个角度看问题，让情绪慢慢变轻。";
      } else if (supMean > reMean) {
        strategy = "更偏向表达抑制";
        summary = "你更习惯把情绪先收起来，之后再慢慢消化。";
      }

      return {
        score: {
          reappraisal_mean: reMean, // 1-7
          suppression_mean: supMean, // 1-7
          reappraisal_sum: reSum,
          suppression_sum: supSum,
        },
        level: { strategy, summary }, // 这里用 level 字段存“倾向”最省事
        flags: { riskLevel: "low" },
      };
    },

    interpret: (res) => [
      `认知重评（适应性）均分：${res.score.reappraisal_mean} / 7`,
      `表达抑制均分：${res.score.suppression_mean} / 7`,
      `策略倾向：${res.level.strategy}`,
    ],
  },
  NET_ADDICT: {
    id: "NET_ADDICT",
    name: "网络成瘾量表（IAT）",
    period: "最近一段时间",
    type: "likert",
    ageRange: { min: 12, max: 18 },
    intro: {
      title: "网络成瘾量表（IAT）",
      prompt: "这是一份关于上网习惯的小测试，请根据你的真实感受选择。",
      paragraphs: [
        "没有对错之分，只需要选择最接近你最近情况的答案。",
        "我们想了解的是你在网络上的感受与行为。",
      ],
    },
    options: [
      { label: "没有", value: 1 },
      { label: "不一定", value: 2 },
      { label: "有一点", value: 3 },
      { label: "大部分", value: 4 },
      { label: "总是", value: 5 },
    ],
    items: [
      { key: "n1", text: "我上网时间太长或上网次数太多。" },
      { key: "n2", text: "我常不由自主地想起或梦见网上的内容。" },
      { key: "n3", text: "我感到平时处处不如别人，才上网的。" },
      { key: "n4", text: "我上网经常超过4小时。" },
      { key: "n5", text: "我曾试过少花点时间上网却做不到。" },
      { key: "n6", text: "我比以前要增加上网时间才能得到满足。" },
      { key: "n7", text: "我平均每周上网时间比前段时间增加了。" },
      { key: "n8", text: "我减少上网时间就心烦意乱。" },
      { key: "n9", text: "我减少上网时间就手指发抖。" },
      { key: "n10", text: "我减少上网时间就不高兴。" },
      { key: "n11", text: "我减少上网时间做其他事情就不安心。" },
      { key: "n12", text: "我控制不住自己上网的冲动。" },
      { key: "n13", text: "我在网上经常忘了时间过了多久。" },
      { key: "n14", text: "我是一到放学就会去上网的。" },
      { key: "n15", text: "我常对别人隐瞒自己上网时间太长。" },
      { key: "n16", text: "我是长期心情低落才上网的。" },
      { key: "n17", text: "平时与人说话紧张是我上网的原因之一。" },
    ],
    score: (answers) => {
      assertAllAnswered(SCALE_BANK.NET_ADDICT, answers);

      const symptomKeys = [
        "n1",
        "n2",
        "n4",
        "n5",
        "n6",
        "n7",
        "n8",
        "n9",
        "n10",
        "n11",
        "n12",
        "n13",
        "n15",
      ];
      const causeKeys = ["n3", "n14", "n16", "n17"];

      const symptom = symptomKeys.reduce((acc, k) => acc + Number(answers[k]), 0);
      const cause = causeKeys.reduce((acc, k) => acc + Number(answers[k]), 0);
      const total = symptom + cause;

      const riskLevel = total > 45 ? "high" : "low";

      return {
        score: {
          total,
          range: "17-85",
          symptom,
          cause,
          threshold: 45,
        },
        level: {
          status: total > 45 ? "超过阈值" : "未超过阈值",
        },
        flags: { riskLevel },
      };
    },
    interpret: (res) => {
      const total = res?.score?.total ?? 0;
      if (total > 45) {
        return [
          `网络小岛的潮位偏高（总分 ${total} / 85）`,
          "这段时间线上活动可能占了不少精力，可以试着给自己留些线下休息的空档。",
        ];
      }
      return [
        `网络小岛的潮位平稳（总分 ${total} / 85）`,
        "目前线上活动比较可控，继续保持节奏就好。",
      ];
    },
  },
  SELF_HARM: {
    id: "SELF_HARM",
    name: "自伤问卷（非自杀性自伤筛查）",
    period: "过去 1 个月",
    type: "likert",
    ageRange: { min: 12, max: 18 },

    // ⭐ 新增：进入问卷前的说明页
    intro: {
      title: "关于自我伤害行为的说明",
      paragraphs: [
        "自我伤害行为是指自己伤害自己身体的行为。",
        "主要包括：切割、抓伤、啃咬、非运动性或娱乐性地击打、扎伤身体、拔头发、用力啃咬或伤害指甲、刺伤身体、撞头、服用非法药物、过量服用药物、服用小剂量药物（不是为了治病）、吞下或喝下不能吃的东西、试图打断骨头等。",
        "本问卷关注的是：不是为了自杀目的的自我伤害行为。",
        "请根据你过去 1 个月内的真实情况作答。"
      ],
      note: "本问卷仅用于了解情况，不作为诊断依据。",
    },

    options: [
      { label: "从未有过", value: 0 },
      { label: "至少一次", value: 1 },
      { label: "每周一次", value: 2 },
      { label: "每日都有", value: 3 },
    ],

    items: [
      { key: "sh1", text: "并不想自杀却想到了自我伤害" },
      { key: "sh2", text: "并不想自杀却实施了自我伤害" },
    ],

    score: (answers) => {
      // 复用你 scaleBank.js 里已有的 assertAllAnswered
      assertAllAnswered(SCALE_BANK.SELF_HARM, answers);

      const ideation = Number(answers.sh1); // 0-3
      const behavior = Number(answers.sh2); // 0-3

      // 你要求：过去1个月“有行为”就高风险
      const riskLevel = behavior >= 1 ? "high" : ideation >= 1 ? "medium" : "low";

      // 给前端/后端留结构化字段（后续做预警、统计更方便）
      return {
        score: {
          ideation,   // 想到
          behavior,   // 行为
        },
        level: {
          summary:
            riskLevel === "high"
              ? "过去1个月内出现过自伤行为"
              : riskLevel === "medium"
              ? "过去1个月内出现自伤想法但未实施"
              : "过去1个月内未报告自伤想法/行为",
        },
        flags: {
          riskLevel,
          // 可选：更细粒度标签
          selfHarmIdeation: ideation >= 1,
          selfHarmBehavior: behavior >= 1,
          hasConcern: ideation >= 1 || behavior >= 1,
          timeWindow: "1m",
        },
      };
    },

    interpret: (res) => [
      `自伤想法频次：${res.score.ideation}（0=从未，1=至少一次，2=每周一次，3=每日都有）`,
      `自伤行为频次：${res.score.behavior}（0=从未，1=至少一次，2=每周一次，3=每日都有）`,
      `风险标记：${res.flags.riskLevel}`,
      res.level.summary,
    ],
  },
  SUICIDE: {
    id: "SUICIDE",
    name: "自杀问卷（风险筛查）",
    period: "既往（按问卷：曾经）",
    type: "screening",
    ageRange: { min: 12, max: 18 },

    // ⭐ 进入问卷前说明页（建议必须有）
    intro: {
      title: "作答说明（自杀风险筛查）",
      paragraphs: [
        "请仔细阅读每一条陈述，选择与你的感受或行为相符合的选项。",
        "答案无所谓对与错，不必在任何一条陈述上花太多时间。",
        "如果你正在经历强烈痛苦或有立即伤害自己的冲动，请优先联系身边可信任的大人/老师/家人，或拨打当地紧急求助电话。"
      ],
      note: "本问卷用于风险筛查，不作为诊断依据。",
    },

    // 默认 options（有/没有）
    options: [
      { label: "有", value: 1 },
      { label: "没有", value: 0 },
    ],

    items: [
      { key: "su1", text: "你曾经有过自杀的想法吗？", kind: "yn" },
      { key: "su2", text: "你曾经制定过自杀计划吗？", kind: "yn" },
      { key: "su3", text: "你曾经企图过自杀吗？", kind: "yn" },

      // 条件题：只有 su3=1 才显示
      {
        key: "su4",
        text: "你有多少次企图自杀？",
        kind: "count",
        showIf: (answers) => Number(answers.su3) === 1,
        options: [
          { label: "0次", value: 0 },
          { label: "1次", value: 1 },
          { label: "2次", value: 2 },
          { label: "3次或3次以上", value: 3 },
        ],
      },
    ],

    score: (answers) => {
      // 只校验“应该出现的题目”
      const visibleItems = SCALE_BANK.SUICIDE.items.filter((it) => {
        if (!it.showIf) return true;
        return it.showIf(answers);
      });
      const missing = visibleItems.filter((it) => answers[it.key] === undefined);
      if (missing.length) {
        throw new Error(`还有 ${missing.length} 题未作答（例如：${missing[0].key}）`);
      }

      const ideation = Number(answers.su1); // 想法
      const plan = Number(answers.su2);     // 计划
      const attempt = Number(answers.su3);  // 企图/尝试
      const attemptCount = Number(answers.su4 ?? 0);

      // 风险判定（按你之前的定义：计划/尝试=高风险；想法=中风险）
      let riskLevel = "low";
      if (attempt === 1 || attemptCount > 0) riskLevel = "high";
      else if (plan === 1) riskLevel = "high";
      else if (ideation === 1) riskLevel = "medium";

      return {
        score: { ideation, plan, attempt, attemptCount },
        level: {
          summary:
            riskLevel === "high"
              ? "存在较高自杀风险信号（计划或企图/尝试）"
              : riskLevel === "medium"
              ? "存在自杀相关想法信号（建议进一步关注与支持）"
              : "未报告自杀相关想法/计划/企图",
        },
        flags: {
          riskLevel,
          suicideIdeation: ideation === 1,
          suicidePlan: plan === 1,
          suicideAttempt: attempt === 1 || attemptCount > 0,
          hasConcern: ideation === 1 || plan === 1 || attempt === 1 || attemptCount > 0,
        },
      };
    },

    interpret: (res) => [
      `自杀想法：${res.score.ideation ? "有" : "没有"}`,
      `自杀计划：${res.score.plan ? "有" : "没有"}`,
      `自杀企图/尝试：${res.score.attempt || res.score.attemptCount > 0 ? "有" : "没有"}`,
      `企图次数：${res.score.attemptCount}`,
      `风险标记：${res.flags.riskLevel}`,
      res.level.summary,
    ],
  },
  ACADEMIC_BURNOUT: {
    id: "ACADEMIC_BURNOUT",
    name: "学业倦怠量表",
    period: "近期（按问卷：最近/最近一段时间）",
    type: "likert",
    ageRange: { min: 12, max: 18 },
    intro: {
      title: "学业倦怠量表",
      prompt: "最近学习时的感觉如何？是充满动力，还是有点累？",
      paragraphs: [
        "此部分是你对自己学习状况的描述，请在符合自己实际情况的选项上划“√”，每题只选择一个答案，请不要多选或漏选。",
      ],
    },
    options: [
      { label: "很不符合", value: 1 },
      { label: "不太符合", value: 2 },
      { label: "不确定", value: 3 },
      { label: "有点符合", value: 4 },
      { label: "非常符合", value: 5 },
    ],
    items: [
      { key: "ab1",  text: "我能够精力充沛地投入学习；", reverse: true },
      { key: "ab2",  text: "最近感到心里很空，不知道该干什么；" },
      { key: "ab3",  text: "我学习太差了，真想放弃；" },
      { key: "ab4",  text: "我经常能够达到自己的目标；", reverse: true },
      { key: "ab5",  text: "一天的学习结束，我感到疲惫至极；" },
      { key: "ab6",  text: "我觉得自己反正不懂，学不学都无所谓；" },
      { key: "ab7",  text: "当学习时，我忘记了周围的一切；", reverse: true },
      { key: "ab8",  text: "最近一段时间，我常常感到筋疲力尽；" },
      { key: "ab9",  text: "学习方面，我体会不到成就感；" },
      { key: "ab10", text: "我觉得学习对我没有意义；" },
      { key: "ab11", text: "我能够很好地应付考试；", reverse: true },
      { key: "ab12", text: "在学校，我经常感到筋疲力尽；" },
      { key: "ab13", text: "我抱着玩世不恭的态度学习；" },
      { key: "ab14", text: "我能有效地解决自己学习中出现的问题；", reverse: true },
      { key: "ab15", text: "我总能能够轻松应付学习方面的问题", reverse: true },
      { key: "ab16", text: "我很容易掌握所学知识。", reverse: true },
    ],

    score: (answers) => {
      assertAllAnswered(SCALE_BANK.ACADEMIC_BURNOUT, answers);

      // 反向计分：1<->5, 2<->4, 3->3
      const reverse5 = (v) => 6 - Number(v);

      let total = 0;
      let reversedCount = 0;

      for (const it of SCALE_BANK.ACADEMIC_BURNOUT.items) {
        const v = Number(answers[it.key]);
        const scoredV = it.reverse ? reverse5(v) : v;
        total += scoredV;
        if (it.reverse) reversedCount += 1;
      }

      const mean = Number((total / SCALE_BANK.ACADEMIC_BURNOUT.items.length).toFixed(2));

      // 先不做阈值分级（你文档没给 cut-off）
      return {
        score: {
          total,             // 16~80（反向后）
          mean,              // 1~5
          items: 16,
          reversedItems: reversedCount,
        },
        level: { total: "—" },
        flags: { riskLevel: "low" },
      };
    },

    interpret: (res) => [
      `总分：${res.score.total}（16题；分数越高表示学业倦怠体验越强）`,
      `均分：${res.score.mean} / 5`,
    ],
  },
  SCHOOL_AVERSION: {
    id: "SCHOOL_AVERSION",
    name: "厌学量表",
    period: "近期（按问卷：你的实际情况）",
    type: "likert",
    ageRange: { min: 12, max: 18 },
    intro: {
      title: "厌学量表",
      prompt: "最近想到上学时的感受如何？轻松、平常，还是有点抗拒？",
      paragraphs: [
        "请根据你的实际情况，对下列各题选择合适的选项划“√”。",
        "（1=完全不符合，2=不符合，3=不确定，4=符合，5=完全符合）",
      ],
    },
    options: [
      { label: "完全不符合", value: 1 },
      { label: "不符合", value: 2 },
      { label: "不确定", value: 3 },
      { label: "符合", value: 4 },
      { label: "完全符合", value: 5 },
    ],
    items: [
      { key: "sa1",  text: "学习常常让我感到身心疲惫；" },
      { key: "sa2",  text: "我从学习中得不到任何乐趣；" },
      { key: "sa3",  text: "我经常想方设法逃避学习；" },
      { key: "sa4",  text: "学习经常使我内心紧张焦虑；" },
      { key: "sa5",  text: "学习常常使我有压力；" },
      { key: "sa6",  text: "我一学习就觉得心烦意乱；" },
      { key: "sa7",  text: "我老想着上网玩游戏、聊天、看视频等；" },
      { key: "sa8",  text: "我觉得我在学校的日子是得过且过；" },
      { key: "sa9",  text: "我上课经常注意力不集中，容易开小差；" },
      { key: "sa10", text: "我认为学习一点意思也没有；" },
      { key: "sa11", text: "我不会根据学习任务制定学习计划；" },
      { key: "sa12", text: "我在学习上的自控力很差；" },
      { key: "sa13", text: "我常常不能独立完成作业；" },
      { key: "sa14", text: "我学习只是迫于家长或老师的压力；" },
      { key: "sa15", text: "我觉得老师讲的好多内容对我没有用；" },
      { key: "sa16", text: "我没有课前预习课后复习的习惯；" },
      { key: "sa17", text: "我认为学习是一种负担；" },
    ],

    score: (answers) => {
      assertAllAnswered(SCALE_BANK.SCHOOL_AVERSION, answers);

      const keys = SCALE_BANK.SCHOOL_AVERSION.items.map((i) => i.key);
      const total = keys.reduce((acc, k) => acc + Number(answers[k]), 0);
      const mean = Number((total / keys.length).toFixed(2)); // 1~5

      let level = "无厌学";
      let riskLevel = "low";
      if (mean >= 4) {
        level = "重度厌学";
        riskLevel = "high";
      } else if (mean >= 3) {
        level = "轻度厌学";
        riskLevel = "medium";
      }

      return {
        score: { total, mean, items: keys.length, range: "17-85" },
        level: { total: level },
        flags: { riskLevel },
      };
    },

    interpret: (res) => [
      `总分：${res.score.total}（范围 ${res.score.range}；分数越高表示厌学体验越强）`,
      `均分：${res.score.mean} / 5`,
    ],
  },
  ANHEDONIA: {
    id: "ANHEDONIA",
    name: "快感缺失量表",
    period: "过去两星期",
    type: "likert",
    ageRange: { min: 12, max: 18 },

    // ⭐ 建议有说明页（和自伤/自杀一样严谨）
    intro: {
      title: "快感缺失量表",
      prompt: "最近做一些事情时，还能感受到开心或兴趣吗？一起看看最近的状态。",
      paragraphs: [
        "本问卷旨在了解你在过去两星期内，对生活中有趣、愉快事情的感受程度。",
        "这里所说的“快感”，包括对活动的兴趣、期待、动力，以及情绪上的愉快体验。",
        "请根据你过去两星期内的真实体验作答，而不是你希望自己达到的状态。"
      ],
      note: "本问卷仅用于了解体验状况，不作为诊断依据。",
    },

    options: [
      { label: "从未", value: 0 },
      { label: "有时", value: 1 },
      { label: "经常", value: 2 },
      { label: "总是", value: 3 },
    ],

    items: [
      { key: "a1",  text: "我没有动力开始做事；" },
      { key: "a2",  text: "没有什么能让我感到兴奋；" },
      { key: "a3",  text: "我本该享受生活中的事物，但我做不到；" },
      { key: "a4",  text: "我感到自己和他人隔绝了；" },
      { key: "a5",  text: "我对任何事情都没有期待；" },
      { key: "a6",  text: "没有什么事情是有趣的，或者能让我乐在其中的；" },
      { key: "a7",  text: "我可以预见自己在未来也难以享受生活中的乐趣；" },

      // ⭐ 正向题，需要反向计分
      { key: "a8",  text: "我感到热情洋溢；", reverse: true },

      { key: "a9",  text: "我什么都不想做；" },
      { key: "a10", text: "我假装有东西让我兴奋，但实际上我觉得它们很无聊；" },

      // ⭐ 正向题
      { key: "a11", text: "我感到自己和周围的世界紧密相连；", reverse: true },

      { key: "a12", text: "我沒有任何情绪；" },
      { key: "a13", text: "所有事情做起来都让我觉得很费力；" },

      // ⭐ 正向题
      { key: "a14", text: "我感到自己的生活是有意义和目标的。", reverse: true },
    ],

    score: (answers) => {
      assertAllAnswered(SCALE_BANK.ANHEDONIA, answers);

      // 反向计分（0↔3，1↔2）
      const reverse4 = (v) => 3 - Number(v);

      let total = 0;
      let reversed = 0;

      for (const it of SCALE_BANK.ANHEDONIA.items) {
        const v = Number(answers[it.key]);
        const scored = it.reverse ? reverse4(v) : v;
        total += scored;
        if (it.reverse) reversed += 1;
      }

      const mean = Number((total / SCALE_BANK.ANHEDONIA.items.length).toFixed(2));

      let level = "状态平稳";
      let riskLevel = "low";
      if (mean > 2) {
        level = "持续低落";
        riskLevel = "high";
      } else if (mean > 1) {
        level = "轻度波动";
        riskLevel = "medium";
      }

      return {
        score: {
          total,                 // 0 ~ 42
          mean,                  // 0 ~ 3
          items: 14,
          reversedItems: reversed,
        },
        level: {
          summary: "分数越高表示开心感降低体验越明显",
          tier: level,
        },
        flags: {
          riskLevel,
        },
      };
    },

    interpret: (res) => [
      `总分：${res.score.total}（14题，0–42）`,
      `平均得分：${res.score.mean} / 3`,
      "分数越高，表示在过去两周内，体验愉快、兴趣和动力的困难程度越明显。",
    ],
  },
  BULLYING: {
    id: "BULLYING",
    name: "霸凌主动&被动（含网络欺凌）",
    period: "过去的一年",
    type: "likert",
    ageRange: { min: 10, max: 18 },

    intro: {
      title: "霸凌主动&被动（含网络欺凌）",
      prompt: "和同学相处时，你的感受如何？自在，还是有些不舒服？",
      paragraphs: [
        "本问卷旨在了解你在过去一年中，是否经历过或参与过不同形式的欺凌行为。",
        "欺凌行为包括语言、关系、身体以及网络等多种形式。",
        "请根据你的真实经历作答，无需担心对错。"
      ],
      note: "本问卷用于情况了解，不作为任何评判或诊断依据。",
    },

    options: [
      { label: "没有发生过", value: 0 },
      { label: "发生过 1–2 次", value: 1 },
      { label: "发生过 3–5 次", value: 2 },
      { label: "发生过 6 次以上", value: 3 },
    ],

    items: [
      // —— 被动欺凌（受欺负）——
      { key: "v1", text: "别人给我起侮辱性的外号、骂我、或者取笑和讽刺我；", sub: "victim" },
      { key: "v2", text: "其他同学不让我参加某些活动，把我排斥在他们的朋友之外，或者让他们的朋友不理我；", sub: "victim" },
      { key: "v3", text: "别人打、踢、推、撞、禁闭或者威胁我；", sub: "victim" },
      { key: "v4", text: "别人散布我的一些谣言，并试图使其他人不喜欢我；", sub: "victim" },
      { key: "v5", text: "别人强迫向我要钱，或者拿走或损坏我的东西；", sub: "victim" },
      { key: "v6", text: "别人因为我说话口音和他们不同而给我起侮辱性的外号；", sub: "victim" },
      { key: "v7", text: "别人使用网络或手机短信骂我、侮辱我，或者威胁我；", sub: "victim" },
      { key: "v8", text: "别人使用电话骂我、侮辱我，或者威胁我。", sub: "victim" },

      // —— 主动欺凌（欺负他人）——
      { key: "b1", text: "我给别人起侮辱性的外号骂他们、或者取笑、讽刺他们；", sub: "bully" },
      { key: "b2", text: "我故意不让某个或某些同学参加某些活动，把他们排斥在我的朋友之外，或者让我的朋友不理睬他(们)；", sub: "bully" },
      { key: "b3", text: "我打、踢、推、撞或者威胁他(们)；", sub: "bully" },
      { key: "b4", text: "我散布别人的一些谣言，并试图使其他人不喜欢他(们)；", sub: "bully" },
      { key: "b5", text: "我强迫别的同学给我钱，或者拿走或损坏他(她)的东西；", sub: "bully" },
      { key: "b6", text: "我给某些有不同口音的同学起侮辱性的外号；", sub: "bully" },
      { key: "b7", text: "我使用网络或手机短信辱骂、侮辱，或者威胁过别人；", sub: "bully" },
      { key: "b8", text: "我使用电话辱骂、侮辱，或者威胁过别人。", sub: "bully" },
    ],

    score: (answers) => {
      assertAllAnswered(SCALE_BANK.BULLYING, answers);

      let victimSum = 0;
      let bullySum = 0;
      let victimAny = false;
      let bullyAny = false;

      for (const it of SCALE_BANK.BULLYING.items) {
        const v = Number(answers[it.key]);
        if (it.sub === "victim") {
          victimSum += v;
          if (v >= 1) victimAny = true;
        } else if (it.sub === "bully") {
          bullySum += v;
          if (v >= 1) bullyAny = true;
        }
      }

      const victimMean = Number((victimSum / 8).toFixed(2));
      const bullyMean = Number((bullySum / 8).toFixed(2));

      return {
        score: {
          victim_sum: victimSum,   // 0–24
          bully_sum: bullySum,     // 0–24
          victim_mean: victimMean,
          bully_mean: bullyMean,
        },
        level: {
          summary:
            victimAny || bullyAny
              ? "过去一年中报告过欺凌相关行为或经历"
              : "过去一年中未报告欺凌相关行为或经历",
        },
        flags: {
          riskLevel: victimAny ? "medium" : "low",
          victim: victimAny,
          bully: bullyAny,
          hasConcern: victimAny || bullyAny,
        },
      };
    },

    interpret: (res) => [
      `被动欺凌（受欺负）：总分 ${res.score.victim_sum}，均分 ${res.score.victim_mean}`,
      `主动欺凌（欺负他人）：总分 ${res.score.bully_sum}，均分 ${res.score.bully_mean}`,
      res.level.summary,
    ],
  },
  BULLYING_SIMPLE: {
    id: "BULLYING_SIMPLE",
    name: "霸凌主动&被动（含网络欺凌）",
    period: "过去 12 个月",
    type: "likert",
    ageRange: { min: 8, max: 9 },
    intro: {
      title: "霸凌主动&被动（含网络欺凌）",
      prompt: "下面的问题没有对错，只要选最接近你的情况。",
      paragraphs: [
        "如果发生过类似情况，请选对应的频次。",
        "系统只会告诉你是否需要关注。",
      ],
    },
    options: [
      { label: "从没有过", value: 0 },
      { label: "只发生过 1 次", value: 1 },
      { label: "已经发生了 2 次", value: 2 },
      { label: "发生 > 2 次", value: 3 },
    ],
    items: [
      { key: "b1", text: "在过去的 12 个月中你被欺负过么？", sub: "victim" },
      { key: "b2", text: "在过去的 12 个月中，有人使用互联网、手机短信、微博、微信（或其他电子设备）欺负、取笑或威胁过你么？", sub: "victim" },
      { key: "b3", text: "在过去的 12 个月中你欺负过别人么？", sub: "bully" },
      { key: "b4", text: "在过去的 12 个月中，你使用互联网、手机短信、微博、微信（或其他电子设备）欺负、取笑或威胁过别人么？", sub: "bully" },
    ],
    score: (answers) => {
      assertAllAnswered(SCALE_BANK.BULLYING_SIMPLE, answers);

      const victim1 = Number(answers.b1);
      const victim2 = Number(answers.b2);
      const bully1 = Number(answers.b3);
      const bully2 = Number(answers.b4);

      const victim = victim1 >= 2 || victim2 >= 2;
      const bully = bully1 >= 2 || bully2 >= 2;
      const total = victim1 + victim2 + bully1 + bully2;

      let role = "无卷入";
      if (victim && bully) role = "受害-施暴者";
      else if (victim) role = "受欺负者";
      else if (bully) role = "欺负者";

      return {
        score: {
          total,
          range: "0-12",
          victim_sum: victim1 + victim2,
          bully_sum: bully1 + bully2,
          threshold: 2,
        },
        level: {
          role,
        },
        flags: {
          riskLevel: victim || bully ? "medium" : "low",
          victim,
          bully,
          hasConcern: victim || bully,
        },
      };
    },
    interpret: (res) => [
      `相处小测总分：${res.score.total} / 12`,
      `结果分类：${res.level.role}`,
    ],
  },
};

export function listScales(age) {
  return Object.values(SCALE_BANK)
    .filter((scale) => {
      if (age === undefined || age === null || Number.isNaN(age)) return true;
      const range = scale.ageRange;
      if (!range) return true;
      return age >= range.min && age <= range.max;
    })
    .map(({ id, name, period }) => ({ id, name, period }));
}

export function getScale(scaleId) {
  const scale = SCALE_BANK[scaleId];
  if (!scale) throw new Error(`未知量表：${scaleId}`);
  return scale;
}
