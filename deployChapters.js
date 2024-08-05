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
let LABFOLDER = 'javascript-labs'
const INPUTFILE=join(__dirname, 'JSNAD_labs.json')


init()
//runDeployment()

async function init(){
    const environment = determineHomeAndOS()
    DEPLOYMENT_ROOT = join( environment.home,LABFOLDER) //As default: set users home directory to be the install directory

    if(DEPLOYMENT_ROOT){
        const result = await startDialogue(DEPLOYMENT_ROOT, INPUTFILE)
        if(!result.defaults){
            DEPLOYMENT_ROOT = sanitizePath(DEPLOYMENT_ROOT)
        }
        let validated = validateDirForWrite(DEPLOYMENT_ROOT)
        while(!validated) {
            let {installdir} = await requestNewInstallDirectory('The directory you provided is not a valid directory')
            installdir = sanitizePath(installdir)
            validated = validateDirForWrite(installdir)
            if(validated) {
                DEPLOYMENT_ROOT=installdir
            }
            // console.info(`Could not deploy to to ${DEPLOYMENT_ROOT}.\nLikely causes;\n-> User has no home folder?\n-> Deployment directory already exists?`)
        }
        runDeployment(DEPLOYMENT_ROOT, INPUTFILE)
    } else {
        exit(-1)
    }
    console.info('Your labs can be found here: ', DEPLOYMENT_ROOT)
    exit(0)
}

//TODO: This function seems a little redundant. Should be removed.
function runDeployment(deploypath, jsonpath){
    console.info(`Deploying all sections to: ${deploypath}\\`)
    try {
        parseAndDeploy(jsonpath, deploypath)
    } catch(error){
        console.error(error.message)
        exit(-1)
    }
}
/**
 * @param {string} jsonfilepath must be a valid filepath to a jsonfile
 * @param {string} deploypath must be a valid path for deployment
 * 
 * parses and deploys chapters according to the schema below
 */
function parseAndDeploy(jsonfilepath, deploypath){
    console.info(`Validation: \tstarting validation of ${jsonfilepath}`)
    
    let JSONOBJECT = fs.readFileSync(jsonfilepath).toString()
    JSONOBJECT = JSON.parse(JSONOBJECT)
    if(typeof JSONOBJECT === 'undefined') throw new Error('JSON could not be parsed!')
    
    for(let sectiontitle in JSONOBJECT){
        const chapterArray = JSONOBJECT[sectiontitle]
        if(Array.isArray(chapterArray) ) {
            deploySection(sectiontitle, chapterArray, deploypath)
        } else {
            console.error('Section did not parse correctly and could not be deployed.\nAssignments'+
                'assignments were not an array. Title of section that caused the error: ' + sectiontitle)
        }
    }
}
/**
 * @param {*} sectiontitle The title of the section to deploy, will be created as its own folder
 * @param {*} chapterArray An array of chapters that can be validated with the schema in this module
 * @param {*} deploypath a valid path to deploy the chapter folders
 */
function deploySection(sectiontitle, chapterArray, deploypath){
    console.log(`Deploying section ${sectiontitle}`)
    const sectionpath = join(deploypath, sectiontitle)
    createDirectory(sectionpath)

    deployChapters(sectionpath, chapterArray)
    
}

function deployChapters(sectionroot, chapterArray){
    for(let chapter of chapterArray) {
        deploySingleChapter(chapter, sectionroot)
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

/**
 * @param {*} path should be a string
 * This function checks if path is a valid filepath and normalises it to the current OS
 * It also invalidates the input path, if the path already exists.
 * @returns null if path is not valid, or a sanitized version of the path
 */
function validateDirForWrite(path){
    let result = null
    path = sanitizePath(path)
    if(path && isAbsolute(path) && !fs.existsSync(path)) {
        result = path
        console.info(`${path} is a valid directory for installation!`)
    } 
    return result

    function sanitizePath(path){
        let result = null
        result = normalize(path)
        result = resolve(path)
        return result
    }
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
                    console.error(`Directory at path:\n${err.path}\nalready exists! Skipping write\n`)
                    break;
                default:
                    console.error('An error occurred while trying to create a directory. Aborting deployment!','Are you sure you have the right?')
            }
        } 
    }
}

function validateChapter(chapter){
    let result = false
    //AJV for for validation
    const Ajv = require('ajv')
    const ajv = new Ajv()
    const schema = getChapterSchema()
    const validate = ajv.compile(schema)

    do {
        result = validate(chapter)
    } while(result)
    if(!result) console.error(`validation: \t${path} does not validate according to schema`, validate.errors)

    return result
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