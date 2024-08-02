'use strict'

const {
    startDialogue,
    requestNewInstallDirectory
} = require('./IO/dialogue')

const fs = require('fs')
const {join,isAbsolute,normalize,resolve}=require('path')

//Deployment parameters
//This is the directory on the system that the tasks will be deployed in.
//If not altered, it will install to the users home folder
let DEPLOYMENT_ROOT = null 
let OS = null
const CHAPTER_ROOT = 'JSNAD-Assignments' //This directory will be created in the deployment root, and all chapters created within it.
const INPUTFILE=join(__dirname, 'labs.json')


init()
//runDeployment()

async function init(){
    const environment = determineHomeAndOS()
    DEPLOYMENT_ROOT = environment.home
    OS = environment.home
    let installpath = join(DEPLOYMENT_ROOT,CHAPTER_ROOT)
    installpath = sanitizePath(installpath)

    if(DEPLOYMENT_ROOT){
        const result = await startDialogue(installpath, INPUTFILE)
        if(!result.defaults){
            installpath = join(result.installdir,CHAPTER_ROOT)
            installpath = sanitizePath(installpath)
        }
        let validated = validateInstallDir(installpath)
        while(!validated) {
            const {installdir} = await requestNewInstallDirectory('The directory you provided is not a valid directory')
            sanitizePath(installdir)
            validated = validateInstallDir(installdir)
            if(validated) {
                installpath=installdir
            }
        }
        runDeployment(installpath)
    } else {
        exit(-1)
    }
    console.info('JSNAD Assignments can be found here:',installpath)
    exit(0)
}

function runDeployment(installpath){
    console.info('Deploying')
    const chapterArray = valJSONtoArray(INPUTFILE)
    if(Array.isArray(chapterArray)){
            createDirectory(installpath)
            deployChapters(installpath, chapterArray)
    } else {
        console.info(`Could not determine a valid location for deployment.\nLikely causes;\n-> User has no home folder?\n-> Deployment directory, ${DEPLOYMENT_PATH} already exists?`)
        exit(-1)
    }
}

function deployChapters(CHAPTER_ROOT, chapterArray){
    for(let chapter of chapterArray) {
        deploySingleChapter(chapter, CHAPTER_ROOT)
    }

    function deploySingleChapter(inputChapter, CHAPTER_ROOT){
        const {chapter, purpose, assignments} = inputChapter
        const chapterPath = join(CHAPTER_ROOT, chapter)
        const assignmentsFile = join(CHAPTER_ROOT, chapter, chapter+'.md')
        createDirectory(chapterPath)
        createFile(assignmentsFile)
        deployAssignment()

        function deployAssignment(){
            fs.appendFileSync(assignmentsFile, '# '+purpose+'\n\n')
            for(let assignment of assignments) {
                const {Order, subtitle, description, purpose} = assignment
                const md = '## ' + Order +' '+subtitle+'\n'+'_goal: '+purpose+'_'+'\ntask: '+description+'\n\n'
                fs.appendFileSync(assignmentsFile, md)
            }
        }
    }
}

function sanitizePath(path){
    let result = path
    result = normalize(path)
    result = resolve(path)
    return result
}
/** 
 * considers installation parameters and returns install directory
 */
function validateInstallDir(installDir){
    console.info('Deployment directory: ', installDir)
    let result = false
    if(isAbsolute(installDir) && !fs.existsSync(installDir)) {
        result = true
    } 
    return result
}
/**
 * @returns an object with the current running os and home folder {os,home}
 */
function determineHomeAndOS(){
    const os = require('os')
    return {
        os:os.platform(),
        home:os.homedir()
    }
}
function createFile(filePath){
    try {
        fs.writeFileSync(filePath,"")
    } catch(err)  {
        console.log(err)
        abortAndCleanup()
    }
}

function createDirectory(directory){
    if(typeof directory === 'string'){
        try {
            fs.mkdirSync(directory,{recursive:true})
        } catch (err){
            switch(err.code){
                case 'EEXIST':
                    console.error(`Directory at path:\n${err.path}\nalready exists. Aborting deployment!\n`)
                    abortAndCleanup(directory)
                    break;
                default:
                    console.error('An error occurred while trying to create a directory. Aborting deployment!','Are you sure you have the right?')
                    abortAndCleanup(directory)
            }
        } 
    }
}

/**
 * @param {*} path must be a valid filepath to a jsonfile
 * @returns an array of chapters according to the schema, or null if validation fails
 */
function valJSONtoArray(path){
    let result = null
    console.info(`Validation: \tstarting validation of ${path}`)
    
    const JSONOBJECT = fs.readFileSync(path).toString()
    const chapterArray = JSON.parse(JSONOBJECT).chapters

    let isValid=validateChapters();
    if(isValid){
        console.info(`validation: \t${path} validated with no errors!`)
        result = chapterArray
    }

    return result

    function validateChapters(){
        let result = true
        //AJV for for validation
        const Ajv = require('ajv')
        const ajv = new Ajv()
        const schema = getChapterSchema()
        const validate = ajv.compile(schema)
        for(let chapter of chapterArray){
            if(!validate(chapter)) {
                console.error(`validation: \t${path} does not validate according to schema`, validate.errors)
                result = false
                break;
            }
        }
        return result
    }
}

function getChapterSchema(){
    return {
        type: "object",
        properties: {
            chapter: {type: "string"},
            purpose: {type: "string"},
            assignments: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        Order: {type: "number"},
                        subtitle: {type: "string"},
                        description: {type: "string"},
                        purpose: {type: "string"}
                    },
                    required: ["Order", "subtitle", "description", "purpose"],
                    additionalProperties: false
                },
            },
            
        },
        required: ["chapter","purpose","assignments"],
        additionalProperties: false
    }
}

//TODO IMPLEMENT
// SHOULD REMOVE ALL DIRECTORIES AND FILES THAT WHERE CREATED, IF ANY
function abortAndCleanup(PATH){
    if(typeof PATH !== 'string') PATH = join(DEPLOYMENT_ROOT, CHAPTER_ROOT)
    if(isValidPath(PATH)){
        console.info(`Aborting deployment!\nRemoving directory:\t${PATH}`)
        fs.rmSync(PATH, {recursive: true})
    }
    exit(-1);
}

function isValidPath(path){
    return fs.existsSync(path)
}

function exit(code=-1){
    process.exit(code)
}