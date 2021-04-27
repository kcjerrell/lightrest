let logLevel = 3;

export function log(data, level = 3) {
    if (level >= logLevel)
        console.log(JSON.stringify(data));
}

export function setLevel(level)
{
    logLevel = level;
}