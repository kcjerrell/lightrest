let _my_log_verbosity_ = 1;

export function log(data, level = 1) {
    if (level <= _my_log_verbosity_)
        console.log(data.toString());
}

export function set_verbosity(level)
{
    _my_log_verbosity_ = level;
}