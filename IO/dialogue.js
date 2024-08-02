
const readline = require('readline')
const terminal = init()

function init(){
    return readline.createInterface({
        input:process.stdin,
        output:process.stdout
    })
}

async function startDialogue(installDir, jsonInput){
    const query = 
    `This is the deploymentwizard for your JSNAD assignments:\n`+
    `Default values for the installationa are:\n`+
    `installation directory:\t${installDir}\n`+
    `Input file:\t\t${jsonInput}\n`+
    'Installation directory will be created for you\n'+
    'Are default values ok? [YES|no]:\t';

    return new Promise((resolve, reject)=>{
        terminal.question(query, async input => {
            input = input.toLowerCase().trim()
            if(input ==='yes' || input === 'y' || input.length === 0){
                resolveAndClose({defaults: true})
            } else {
                let result = await requestNewInstallDirectory()
                resolveAndClose(result)
            }
        })
        function resolveAndClose(result){
            resolve(result)
            //terminal.close()
        }
    })
}

async function requestNewInstallDirectory(extrainfo){
    if(typeof extrainfo !== 'undefined') console.info(extrainfo)
    const query = `Please enter the full path of the directory where you want to deploy your JSNAD assignments folder:`;
    return new Promise((resolve, reject)=>{
        terminal.question(query, input => {
            if(typeof input === 'string' && input.length > 1) {
                resolveAndClose({defaults: false, installdir: input})
            } else {
                requestNewInstallDirectory('Please try again!')
            }
        })
        function resolveAndClose(result){
            resolve(result)
           // terminal.close()
        }
    })
}

module.exports={
    startDialogue,
    requestNewInstallDirectory
}