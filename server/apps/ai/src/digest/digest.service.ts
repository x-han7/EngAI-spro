import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@libs/shared';
import dayjs from 'dayjs';
import { createAgent } from 'langchain';
import { createDeepSeek } from '../llm/llm.config';
import { tool } from '@langchain/core/tools'; //引入langchain的工具
import marked from 'marked';
import { Queue } from 'bullmq'; //类型
import { digestQueueName } from './digest.queue';
import { InjectQueue } from '@nestjs/bullmq';
@Injectable()
export class DigestService implements OnModuleInit {
  constructor(
    private readonly prismaService: PrismaService,
    @InjectQueue(digestQueueName.name) private readonly digestQueue: Queue,
  ) {}

  //普通的大模型他只能输出文字，他没有办法进行比如查看代码 查看图片 或者是连接数据库
  //也就是说大模型会根据我们的tool里面的描述会自动选择要不要调用这个工具
  private queryTool() {
    return tool(
      async ({ userId }: { userId: string }) => {
        const user = await this.prismaService.user.findFirst({
          where: {
            id: userId,
          },
          select: {
            email: true, //邮箱
            name: true, //用户名
            wordNumber: true, //单词数量
            //查询今天的单词记录
            wordBookRecords: {
              where: {
                createdAt: {
                  //今天00:00:00 - 明天00:00:00
                  gte: dayjs().startOf('day').toDate(),
                  lte: dayjs().add(1, 'day').startOf('day').toDate(),
                },
              },
              select: {
                //找到那个表
                word: {
                  select: {
                    //找到那个单词
                    word: true,
                  },
                },
              },
            },
          },
        });
        return user;
      },
      {
        name: 'queryTool', //名字一定要语义化 唯一不能重复
        description: '根据用户id查询用户学习的单词记录', //他会通过desc 和 name 选择要不要调用这个工具
        //JSON Schema 是用来描述数据结构的，他可以用来验证数据是否符合要求
        //给大模型看的 {userId: '1234567890'}
        schema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: '用户id' },
          },
          required: ['userId'],
        },
      },
    );
  }
  async onModuleInit() {
    this.digestQueue.add(
      digestQueueName.task.everyDayDigest,
      {},
      {
        repeat: {
          pattern: '0 0 * * *', //每天0点执行 cron
        },
      },
    );
  }

  async handleEmailDigest() {
    console.log('定时任务执行了');
    //1.筛选高质量用户(打开定时任务 + 定时任务有时间 + 今天学过的单词 + 邮箱不为空)
    const userIds = await this.prismaService.user.findMany({
      where: {
        isTimingTask: true, //开启了定时任务
        timingTaskTime: { not: '' }, //定时任务时间不为空
        email: { not: null }, //邮箱不为空
        wordBookRecords: {
          //some: 至少有一个 every全部满足 none空的
          //createdAt创建时间00:00:00 - 明天的00:00:00
          some: {
            createdAt: {
              gte: dayjs().startOf('day').toDate(), //>=今天00:00:00
              lte: dayjs().add(1, 'day').startOf('day').toDate(), //<=明天00:00:00
            },
          },
        },
      },
      select: {
        id: true,
        timingTaskTime: true,
        email: true,
      },
    });
    for (const user of userIds) {
      const agent = createAgent({
        model: createDeepSeek(),
        tools: [this.queryTool()],
        systemPrompt: `【角色设定】
              你是一位专业的词汇学习日报编辑，擅长将每日单词学习转化为一份简洁、有趣、易回顾的日报简报。
              【任务】
              请为以下今日学习的单词生成一份《每日单词记忆日报》，包含以下板块：
              📰 日报标题
              用1个主单词或主题，生成吸引人的日报标题（示例如："拖延症患者的自我修养 | 4词晚报"）
              🎯 今日词单速览
              表格形式：序号 | 单词 | 音标 | 核心释义 | 记忆星级（⭐-⭐⭐⭐）
              🔗 词群故事线
              用3-4句话，将今日单词编织进一个具体场景/故事，建立情感连接和逻辑关联
              💡 记忆点津（每个单词）
              - 词根拆解 / 谐音联想 / 图像记忆
              - 1个地道搭配
              - 易混词预警（如有）
              🎓 今日微测试
              出4道选择题或填空题，帮助自测（附答案）
              📌 编辑寄语
              30字以内的学习建议
              15字以内的鼓励话语，提升用户学习动力
              【风格要求】
              - 语言：轻松、有节奏感，像读 newsletter
              - 排版：样式一定要好看优雅，用符号和空行清晰分段
              - 语言轻松有节奏感，像读 newsletter
              - 长度：整体控制在手机一屏内可读完

              【今日单词】
              （用户会在此处提供单词列表）`,
      });
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `用户id: ${user.id}，查询该用户信息,并且根据用户id关联单词记录表，查询出用户今天的单词记录,过滤掉敏感信息,不要有多余的解释`,
          },
        ],
      });
      console.log('agent结果', result);
      const content = result.messages.at(-1)?.content;
      if (content) {
        const html = await marked.parse(content as string);
        const [hour, minute, second] = user.timingTaskTime
          .split(':')
          .map(Number);
        const target = dayjs()
          .startOf('day')
          .set('hour', hour)
          .set('minute', minute)
          .set('second', second);
        let delay = target.diff(dayjs());
        if (delay < 0) {
          delay = 0;
        }
        this.digestQueue.add(
          digestQueueName.task.emailDigest,
          {
            userId: user.id,
            text: html,
            email: user.email,
            subject: `📰 您的每日单词记忆日报 | ${dayjs().format('MM月DD日')}`,
          },
          {
            delay: delay,
          },
        );
      }
    }
  }
}
