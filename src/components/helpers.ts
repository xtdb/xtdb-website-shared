type Feed = {
    title: string,
    subtitle: string,
    url: string
}

type Analytics = {
    url: string,
    siteId: string
}

type TypeSense = {
    apiKey: string,
    host: string,
    collectionName: string,
}

type Site = {
    name: string,
    url: string,
    authorName: string,
    authorEmail: string,
    feed: Feed,
    analytics: Analytics,
    typesense: TypeSense
}

type Destination = {
    id: string
    label: string
    path: string
    icon?: string
    description?: string
}

type FooterSection = {
    name: string
    items: [string]
}

export type Logo = {
    url: string,
    path: string,
    title: string
}

type LogoLists = {
    platforms: [Logo]
    customers: [Logo]
}

const meta_glob = import.meta.glob<
{ site: Site, mainNav: string[], allDestinations: Destination[], footer: FooterSection[], footerLegals: string[],
  communitySupportChannels: string[], logos: LogoLists }
>('../data/metadata.json', { eager: true })

const metadata = meta_glob['../data/metadata.json']
const { site, mainNav, allDestinations, footer, communitySupportChannels, logos} = metadata

export { metadata, site, mainNav, allDestinations, footer, communitySupportChannels, logos}

export function getNavItemById(id) {
    return allDestinations.find((d) => d.id === id);
}

export function getNavItems(ids) {
    return ids.map(getNavItemById).filter((x) => x);
}

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
