import { DocumentationGenerator, DocumentationGeneratorOptions } from "."
import { getFilesInDirectory } from "../helpers"
import { existFile, isDirectory, readFileJSON, writeFileJSON } from "../helpers/node_gm"
import * as path from 'path'
import { program } from 'commander'

program
    .option('--maxTokens <maxTokens>', 'the maximum number of tokens that the model can accept')
    .option('--bytesPerToken <bytesPerToken>', 'approximate number of bytes in one token')
    .option('--maxQueries <maxQueries>', 'Maximum number of requests simultaneously')
    .option('--outFile <outFile>', 'The file to write the result')
    .option('--config <config>', 'The file to read the config from')
    .option('--maxTokensFile <maxTokensFile>', 'The max tokens values for files')
    .option('--maxTokensDir <maxTokensDir>', 'The max tokens values for directories')
    .option('--bytesPerToken <bytesPerToken>', 'approximate number of bytes in one token')
    .option('--temperature <temperature>', 'The temperature of the model')
    .option('--excludes <excludes>', 'The pattern to exclude files. Example: dir1,dir2,file3,*.png')
    .option('--model <model>', 'The model to use')
    .parse(process.argv)

const rootDirOrSelectedFile = process.argv[3]
const apiKey = process.argv[2]

async function update(rootDirOrSelectedFile: string) {
    const isDir = isDirectory(rootDirOrSelectedFile)
    const cliOptions = program.opts()
    const configFile = cliOptions?.config || (isDir ? path.resolve(rootDirOrSelectedFile, "docs.ai.config.json") : path.resolve(__dirname, "docs.ai.config.json"))
    const config: DocumentationGeneratorOptions & {outFile?: string, excludes?: string} = existFile(configFile) ? readFileJSON(configFile) : null

    const maxQueries = +cliOptions?.maxQueries || config?.maxQueries || 5
    const maxTokens = +cliOptions?.maxTokens || config?.maxTokens || 4097
    const bytesPerToken = +cliOptions?.bytesPerToken || config?.bytesPerToken || 4
    const temperature = +cliOptions?.temperature || config?.temperature
    const model = cliOptions?.model || config?.model
    const maxTokensFile = +cliOptions?.maxTokensFile || config?.maxTokensFile
    const maxTokensDir = +cliOptions?.maxTokensDir || config?.maxTokensDir
    const excludes = cliOptions?.excludes || config?.excludes

    const options = {
        maxQueries,
        apiKey,
        cli: true,
        maxTokens,
        bytesPerToken,
        temperature,
        model,
        maxTokensFile,
        maxTokensDir
    }

    let files = isDir ? getFilesInDirectory(rootDirOrSelectedFile, rootDirOrSelectedFile) : readFileJSON(rootDirOrSelectedFile)
    if (excludes) {
        files = files.filter((file) => {
            const excludesCondition = excludes
                .split(",")
                .map((el) => el.trim())
                .every((exclude) => {
                    if (exclude.startsWith("*")) {
                        if (exclude.endsWith("*")) {
                            return !file.path.includes(exclude.slice(1, -1))
                        }
                        return !file.path.endsWith(exclude.slice(1))
                    } else {
                        return !file.path.startsWith(exclude)
                    }
                })
            const maxSizeCondition = ((file.size || 0) <= (maxTokens - (maxTokensFile || 150)) * bytesPerToken)
            return maxSizeCondition && ((!excludes) || excludesCondition)
        })
    }

    // Only files that have not descriptions
    const prevResultFile = cliOptions?.outFile || config?.outFile || (isDir ? path.resolve(rootDirOrSelectedFile, "docs.ai.json") : path.resolve(__dirname, "docs.ai.json"))
    const prevResult = existFile(prevResultFile) ? readFileJSON(prevResultFile).filter((prevResultFileOne) => prevResultFileOne.description) : []
    files = files.filter((file) => {
        const prevFile = prevResult.find((prevFile) => prevFile.path === file.path)
        return !prevFile || !prevFile.description
    })

    const generator = new DocumentationGenerator(files, options, prevResult)
    await generator.start()
    const resFile = cliOptions?.outFile || config?.outFile || (isDir ? path.resolve(rootDirOrSelectedFile, "docs.ai.json") : path.resolve(__dirname, "docs.ai.json"))
    const resFiles = files.map((selectedFile) => ({ path: selectedFile.path, description: selectedFile.description, size: selectedFile.size }))
    const prevResFiles = prevResult
        .map((prevResultFileOne) => ({ path: prevResultFileOne.path, description: prevResultFileOne.description, size: prevResultFileOne.size }))
        .filter((prevResultFileOne) => !resFiles.find((resFileOne) => resFileOne.path === prevResultFileOne.path))
    const mergedFiles = [...prevResFiles, ...resFiles]
    writeFileJSON(resFile, mergedFiles)
    console.log("Done! The result in the file:", resFile)
}

// Wrap your async function in an async IIFE
(async () => {
    try {
        await update(rootDirOrSelectedFile)
    } catch (error) {
        console.error('Error occurred:', error)
        process.exit(1)
    }
    console.log('Async function completed successfully')
    process.exit(0)
})()
