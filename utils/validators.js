function valid_not_empty (d) {
    return d !== undefined && d.length > 0 && d.trim().length > 0;
}
function valid_phone_or_email (d) {
    return d !== undefined && d.length > 0 && (valid_phone(d) || valid_email(d));
}
function valid_min_length (len) {
    return (d) => {
        return d !== undefined && d.length >= len;
    };
}
function valid_same (to) {
    return (from) => {
        return from === to;
    };
}
function valid_phone (d) {
    return /^(0|86|17951)?(13[0-9]|14[0-9]|15[0-9]|16[0-9]|17[0-9]|18[0-9]|19[0-9])[0-9]{8}$/.test(d);
}
function valid_email (d) {
    // eslint-disable-next-line no-useless-escape
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(d);
}
function valid_id_num (d) {
    return /^[1-9]\d{5}(18|19|([23]\d))\d{2}((0[1-9])|(10|11|12))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/.test(d);
}

module.exports = {
    valid_email,
    valid_id_num,
    valid_min_length,
    valid_not_empty,
    valid_phone,
    valid_phone_or_email,
    valid_same
}