import Link from 'next/link';
import BookingForm from '../components/BookingForm';
import {getSettings} from '../lib/store';
import {calendarEnvironment} from '../lib/calendar';
export const dynamic='force-dynamic';
export const metadata={title:'Book a consultation | JMP',robots:{index:false,follow:true}};
export default async function BookConsultation(){const settings=await getSettings(),ready=settings.bookingEnabled&&calendarEnvironment().configured;return <main id="main-content" className="public-main" tabIndex={-1}><section className="section"><div className="container booking-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/contact">Contact</Link><span>/</span><span aria-current="page">Consultation</span></nav><span className="eyebrow">Let’s make time to talk</span><h1>Book a consultation.</h1>{ready?<BookingForm services={settings.formServices}/>:<div className="booking-unavailable"><h2>Let’s arrange a suitable time.</h2><p>Online appointments are currently unavailable. Send an enquiry and the team will help arrange your consultation.</p><Link className="btn" href="/contact#enquiry-form">Request a consultation</Link></div>}</div></section></main>;}
