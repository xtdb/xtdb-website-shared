export function mailToUrl(email, subject, body) {
    let url = `mailto:${email}`;

    if (subject) {
        url = `${url}?subject=${subject}`;
    }

    if (body) {
        const separator = subject ? "&" : "?";
        url = `${url}${separator}body=${body}`;
    }
    
    return url;
}
