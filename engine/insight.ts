import { lengthToTokensCount } from "../helpers"
import { readFileJSON } from "../helpers/node_gm"
import { IFile } from "../types"
import { getAnswer, gptAPI } from "./api"

export interface InsightOptions {
    apiKey?: string
    cli?: boolean
    fileNames?: string[]
    filesStr?: string
    contentStr?: string
    mode?: 'singlePrompt' | 'chat'
    maxTokensShift?: number
    timeout?: number
}

export class Insight {
    private documentation: IFile[];
    private opts: Partial<InsightOptions>;
    private isStopped: boolean;

    constructor(documentation: IFile[], opts?: InsightOptions) {
        this.documentation = documentation
        this.opts = opts || {}
        this.isStopped = false
    }

    public async askFiles(prompt: string, opts?: InsightOptions): Promise<string> {
        if (this.opts.apiKey) {
            gptAPI.setApiKey(this.opts.apiKey)
        }
        const thePrompt = `I give a question: "${prompt}"
And the list of files:
${opts?.filesStr || (opts?.fileNames || []).join('\n')}
You need to decide you have enough information to answer the question or not.
If you have enough information, you can answer the question.
If you don't have enough information, you need to ask me about descriptions of which exactly files do you need.
Use the format :file1, file2, ...
`
        // call the first prompt
        console.log("insight.askFiles", {thePromptLength: lengthToTokensCount(thePrompt.length)})
        const res = await getAnswer(thePrompt, {timeout: 120000, max_tokens: Math.floor(4097 - lengthToTokensCount(thePrompt.length) - (opts?.maxTokensShift || 100)), ...opts})
        return res || ''
    }

    public async ask(prompt: string, opts?: InsightOptions): Promise<string> {
        if (this.opts.apiKey) {
            gptAPI.setApiKey(this.opts.apiKey)
        }
        const filesStr = opts?.filesStr || (opts?.fileNames || []).join('\n')
        const contentStr = opts?.contentStr || ''
        const thePrompt = `${prompt}
${(filesStr || contentStr) ? 'To answer' : ''}
${filesStr ? 'Use the list of files:\n' + filesStr : ''}
${contentStr ? 'Use the content:\n' + contentStr : ''}
`
        console.log("insight.ask", {thePromptLength: lengthToTokensCount(thePrompt.length)})
        const res = await getAnswer(thePrompt, {timeout: 120000, max_tokens: Math.floor(4097 - lengthToTokensCount(thePrompt.length) - (opts?.maxTokensShift || 100)), ...opts})
        return res || ''
    }

    public parseFiles(res: string): string[] {
        const result = [] as string[]
        res.match(/needFilesDescriptions: \[(.*?)\]/g)?.forEach((match) => {
            const files = match.replace('needFilesDescriptions: [', '').replace(']', '').split(', ')
            result.push(...files)
        })
        return result
    }

    public stop(): void {
        this.isStopped = true
    }
}
