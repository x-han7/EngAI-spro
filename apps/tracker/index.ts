import type { TrackerConfig } from '@en/common/tracker';
import { getFingerprint } from '@/uv';
import { reportEvent } from '@/event';
import { reportError } from '@/error';
import { reportPv } from '@/pv';
import { reportPerformance } from '@/performance';
import { reportFetch } from '@/report';
export class Tracker {
    private config: TrackerConfig
    private visitorId: string | null = null
    private initPromise: Promise<void> | null = null
    constructor(config: TrackerConfig) {
        this.config = config
        this.init() //初始化方法
    }
    //protected 允许子类和内部使用
    protected async init() {
        if (this.initPromise) return this.initPromise //确保他是同一个promise
        //IIFE立即执行函数
        this.initPromise = (async () => {
            let config = this.config
            this.visitorId = await getFingerprint(config)
            reportEvent(this.visitorId, config) 
            reportError(this.visitorId, config) 
            reportPv(this.visitorId, config) 
            reportPerformance(this.visitorId, config) 
        })()
        return this.initPromise
    }

    public async setUserId(userId: string) {
        await this.init() //确认 init 已经跑完了再往下走
        let url = this.config.baseUrl + this.config.uv.updateApi
        await reportFetch(url, {
            visitorId: this.visitorId,
            userId: userId
        })
    }
}
