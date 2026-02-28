/**
 * Export Service
 * Handles CSV and PDF export functionality for analytics reports
 */

import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

class ExportService {
  /**
   * Export data to CSV format
   * @param {Object} data - Complete analytics data
   * @param {String} reportType - Type of report (comprehensive, listings, users, financial, etc.)
   */
  exportToCSV(data, reportType = 'comprehensive') {
    const csvSections = [];

    // Header
    csvSections.push('GharKhoj Admin Analytics Report');
    csvSections.push(`Generated: ${new Date().toLocaleString()}`);
    csvSections.push(`Report Type: ${reportType}`);
    csvSections.push('');

    switch (reportType) {
      case 'comprehensive':
        this.addComprehensiveDataToCSV(csvSections, data);
        break;
      case 'listings':
        this.addListingDataToCSV(csvSections, data);
        break;
      case 'users':
        this.addUserDataToCSV(csvSections, data);
        break;
      case 'financial':
        this.addFinancialDataToCSV(csvSections, data);
        break;
      case 'rental-activity':
        this.addRentalActivityToCSV(csvSections, data);
        break;
      default:
        this.addComprehensiveDataToCSV(csvSections, data);
    }

    return csvSections.join('\n');
  }

  /**
   * Add comprehensive data to CSV
   */
  addComprehensiveDataToCSV(csvSections, data) {
    // Listing Overview
    if (data.listing_overview) {
      csvSections.push('=== LISTING OVERVIEW ===');
      csvSections.push('Metric,Value');
      csvSections.push(`Total Listings,${data.listing_overview.total_listings}`);
      csvSections.push(`Active Listings,${data.listing_overview.active_listings}`);
      csvSections.push(`Inactive Listings,${data.listing_overview.inactive_listings}`);
      csvSections.push(`Rented Listings,${data.listing_overview.rented_listings}`);
      csvSections.push(`Verified Listings,${data.listing_overview.verified_listings}`);
      csvSections.push(`Unverified Listings,${data.listing_overview.unverified_listings}`);
      csvSections.push(`Deleted Listings,${data.listing_overview.deleted_listings}`);
      csvSections.push(`Reported Listings,${data.listing_overview.reported_listings}`);
      csvSections.push(`Expired Listings,${data.listing_overview.expired_listings}`);
      csvSections.push('');
    }

    // Property Type Distribution
    if (data.property_types && data.property_types.distribution) {
      csvSections.push('=== PROPERTY TYPE DISTRIBUTION ===');
      csvSections.push('Property Type,Count,Percentage,Average Rent');
      data.property_types.distribution.forEach(item => {
        csvSections.push(`${item.property_type},${item.count},${item.percentage}%,Rs. ${item.avg_rent}`);
      });
      csvSections.push('');
    }

    // Location Distribution
    if (data.locations && data.locations.by_city) {
      csvSections.push('=== LISTINGS BY CITY ===');
      csvSections.push('City,Count,Percentage,Average Rent,Rented Count');
      data.locations.by_city.forEach(item => {
        csvSections.push(`${item.city},${item.count},${item.percentage}%,Rs. ${item.avg_rent},${item.rented_count}`);
      });
      csvSections.push('');
    }

    // Price Reports
    if (data.price_reports && data.price_reports.overall_stats) {
      csvSections.push('=== PRICE STATISTICS ===');
      const stats = data.price_reports.overall_stats;
      csvSections.push('Metric,Value');
      csvSections.push(`Minimum Rent,Rs. ${stats.min_rent}`);
      csvSections.push(`Maximum Rent,Rs. ${stats.max_rent}`);
      csvSections.push(`Average Rent,Rs. ${parseFloat(stats.avg_rent).toFixed(2)}`);
      csvSections.push(`Median Rent,Rs. ${parseFloat(stats.median_rent).toFixed(2)}`);
      csvSections.push('');
    }

    // User Statistics
    if (data.user_stats && data.user_stats.overall) {
      csvSections.push('=== USER STATISTICS ===');
      const stats = data.user_stats.overall;
      csvSections.push('Metric,Value');
      csvSections.push(`Total Users,${stats.total_users}`);
      csvSections.push(`Total Tenants,${stats.total_tenants}`);
      csvSections.push(`Total Landlords,${stats.total_landlords}`);
      csvSections.push(`Verified Users,${stats.verified_users}`);
      csvSections.push(`Active (Last 7 Days),${stats.active_last_7_days}`);
      csvSections.push(`Active (Last 30 Days),${stats.active_last_30_days}`);
      csvSections.push('');
    }

    // Financial Reports
    if (data.financial_reports && data.financial_reports.overall) {
      csvSections.push('=== FINANCIAL OVERVIEW ===');
      const stats = data.financial_reports.overall;
      csvSections.push('Metric,Value');
      csvSections.push(`Total Revenue,Rs. ${parseFloat(stats.total_revenue || 0).toFixed(2)}`);
      csvSections.push(`Collected Revenue,Rs. ${parseFloat(stats.collected_revenue || 0).toFixed(2)}`);
      csvSections.push(`Pending Revenue,Rs. ${parseFloat(stats.pending_revenue || 0).toFixed(2)}`);
      csvSections.push(`Total Transactions,${stats.total_transactions}`);
      csvSections.push(`Completed Transactions,${stats.completed_transactions}`);
      csvSections.push(`Average Commission,Rs. ${parseFloat(stats.avg_commission || 0).toFixed(2)}`);
      csvSections.push('');
    }

    // Vacancy Rate
    if (data.vacancy_rate && data.vacancy_rate.overall) {
      csvSections.push('=== VACANCY RATE ===');
      const stats = data.vacancy_rate.overall;
      csvSections.push('Metric,Value');
      csvSections.push(`Available Properties,${stats.available}`);
      csvSections.push(`Rented Properties,${stats.rented}`);
      csvSections.push(`Vacancy Rate,${stats.overall_vacancy_rate}%`);
      csvSections.push('');
    }

    // Demand Supply Analysis
    if (data.demand_supply && data.demand_supply.length > 0) {
      csvSections.push('=== DEMAND VS SUPPLY ANALYSIS ===');
      csvSections.push('City,Property Type,Supply,Demand,Unique Searchers,D/S Ratio,Market Status');
      data.demand_supply.slice(0, 20).forEach(item => {
        csvSections.push(`${item.city || 'N/A'},${item.property_type || 'N/A'},${item.supply},${item.demand},${item.unique_searchers},${item.demand_supply_ratio || 'N/A'},${item.market_status}`);
      });
      csvSections.push('');
    }
  }

  /**
   * Add listing-specific data to CSV
   */
  addListingDataToCSV(csvSections, data) {
    if (data.total_listings !== undefined) {
      csvSections.push('=== LISTING OVERVIEW ===');
      csvSections.push('Metric,Value');
      csvSections.push(`Total Listings,${data.total_listings}`);
      csvSections.push(`Active Listings,${data.active_listings}`);
      csvSections.push(`Inactive Listings,${data.inactive_listings}`);
      csvSections.push(`Rented Listings,${data.rented_listings}`);
      csvSections.push(`Verified Listings,${data.verified_listings}`);
      csvSections.push(`Unverified Listings,${data.unverified_listings}`);
      csvSections.push('');
    }

    if (data.distribution) {
      csvSections.push('=== PROPERTY TYPE DISTRIBUTION ===');
      csvSections.push('Property Type,Count,Percentage,Average Rent');
      data.distribution.forEach(item => {
        csvSections.push(`${item.property_type},${item.count},${item.percentage}%,Rs. ${item.avg_rent}`);
      });
    }
  }

  /**
   * Add user-specific data to CSV
   */
  addUserDataToCSV(csvSections, data) {
    if (data.overall) {
      csvSections.push('=== USER STATISTICS ===');
      csvSections.push('Metric,Value');
      csvSections.push(`Total Users,${data.overall.total_users}`);
      csvSections.push(`Total Tenants,${data.overall.total_tenants}`);
      csvSections.push(`Total Landlords,${data.overall.total_landlords}`);
      csvSections.push(`Total Admins,${data.overall.total_admins}`);
      csvSections.push(`Verified Users,${data.overall.verified_users}`);
      csvSections.push('');
    }

    if (data.last_7_days) {
      csvSections.push('=== NEW USERS (LAST 7 DAYS) ===');
      csvSections.push('Metric,Value');
      csvSections.push(`New Users,${data.last_7_days.new_users}`);
      csvSections.push(`New Tenants,${data.last_7_days.new_tenants}`);
      csvSections.push(`New Landlords,${data.last_7_days.new_landlords}`);
      csvSections.push('');
    }

    if (data.last_30_days) {
      csvSections.push('=== NEW USERS (LAST 30 DAYS) ===');
      csvSections.push('Metric,Value');
      csvSections.push(`New Users,${data.last_30_days.new_users}`);
      csvSections.push(`New Tenants,${data.last_30_days.new_tenants}`);
      csvSections.push(`New Landlords,${data.last_30_days.new_landlords}`);
      csvSections.push('');
    }
  }

  /**
   * Add financial data to CSV
   */
  addFinancialDataToCSV(csvSections, data) {
    if (data.overall) {
      csvSections.push('=== FINANCIAL OVERVIEW ===');
      csvSections.push('Metric,Amount (Rs.)');
      csvSections.push(`Total Revenue,${parseFloat(data.overall.total_revenue || 0).toFixed(2)}`);
      csvSections.push(`Collected Revenue,${parseFloat(data.overall.collected_revenue || 0).toFixed(2)}`);
      csvSections.push(`Pending Revenue,${parseFloat(data.overall.pending_revenue || 0).toFixed(2)}`);
      csvSections.push(`Average Commission,${parseFloat(data.overall.avg_commission || 0).toFixed(2)}`);
      csvSections.push('');
      csvSections.push('Metric,Count');
      csvSections.push(`Total Transactions,${data.overall.total_transactions}`);
      csvSections.push(`Completed Transactions,${data.overall.completed_transactions}`);
      csvSections.push('');
    }

    if (data.by_property_type) {
      csvSections.push('=== REVENUE BY PROPERTY TYPE ===');
      csvSections.push('Property Type,Total Revenue,Transaction Count,Avg Commission');
      data.by_property_type.forEach(item => {
        csvSections.push(`${item.property_type},Rs. ${parseFloat(item.total_revenue || 0).toFixed(2)},${item.transaction_count},Rs. ${parseFloat(item.avg_commission || 0).toFixed(2)}`);
      });
      csvSections.push('');
    }

    if (data.periodic) {
      csvSections.push('=== PERIODIC REVENUE ===');
      csvSections.push('Period,Revenue,Transactions');
      csvSections.push(`Last 7 Days,Rs. ${parseFloat(data.periodic.last_7_days || 0).toFixed(2)},${data.periodic.trans_7_days}`);
      csvSections.push(`Last 15 Days,Rs. ${parseFloat(data.periodic.last_15_days || 0).toFixed(2)},${data.periodic.trans_15_days}`);
      csvSections.push(`Last 30 Days,Rs. ${parseFloat(data.periodic.last_30_days || 0).toFixed(2)},${data.periodic.trans_30_days}`);
    }
  }

  /**
   * Add rental activity data to CSV
   */
  addRentalActivityToCSV(csvSections, data) {
    if (data.last_15_days !== undefined) {
      csvSections.push('=== RENTAL ACTIVITY SUMMARY ===');
      csvSections.push('Period,Rented Count');
      csvSections.push(`Last 15 Days,${data.last_15_days}`);
      csvSections.push('');
    }

    if (data.this_month) {
      csvSections.push('=== RENTALS THIS MONTH ===');
      csvSections.push('Property Type,Count');
      data.this_month.forEach(item => {
        csvSections.push(`${item.property_type},${item.rented_count}`);
      });
      csvSections.push('');
    }

    if (data.bookings) {
      csvSections.push('=== BOOKING STATISTICS ===');
      csvSections.push('Metric,Value');
      csvSections.push(`Total Bookings,${data.bookings.total_bookings}`);
      csvSections.push(`Confirmed,${data.bookings.confirmed}`);
      csvSections.push(`Pending,${data.bookings.pending}`);
      csvSections.push(`Cancelled,${data.bookings.cancelled}`);
      csvSections.push(`Last 30 Days,${data.bookings.last_30_days}`);
    }
  }

  /**
   * Generate filename for export
   */
  generateFilename(reportType, format) {
    const timestamp = new Date().toISOString().split('T')[0];
    return `gharkhoj-${reportType}-report-${timestamp}.${format}`;
  }

  /**
   * Export data to PDF format
   * @param {Object} data - Complete analytics data
   * @param {String} reportType - Type of report
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async exportToPDF(data, reportType = 'comprehensive') {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('GharKhoj Analytics Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.fontSize(10).text(`Report Type: ${reportType.toUpperCase()}`, { align: 'center' });
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Add content based on report type
        switch (reportType) {
          case 'comprehensive':
          case 'overview':
            this.addComprehensiveDataToPDF(doc, data);
            break;
          case 'listings':
            this.addListingDataToPDF(doc, data);
            break;
          case 'users':
            this.addUserDataToPDF(doc, data);
            break;
          case 'financial':
            this.addFinancialDataToPDF(doc, data);
            break;
          case 'rental':
          case 'rental-activity':
            this.addRentalActivityToPDF(doc, data);
            break;
          case 'advanced':
            this.addAdvancedDataToPDF(doc, data);
            break;
          default:
            this.addComprehensiveDataToPDF(doc, data);
        }

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).text(
            `Page ${i + 1} of ${pages.count} | GharKhoj Admin Dashboard`,
            50,
            doc.page.height - 50,
            { align: 'center' }
          );
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add comprehensive data to PDF
   */
  addComprehensiveDataToPDF(doc, data) {
    // Set background color to white (to prevent black page)
    doc.fillColor('#000000'); // Ensure text is black on white background

    // Listing Overview
    if (data.listing_overview) {
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Listing Overview', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      
      const metrics = [
        ['Total Listings', data.listing_overview.total_listings],
        ['Active Listings', data.listing_overview.active_listings],
        ['Inactive Listings', data.listing_overview.inactive_listings],
        ['Rented Listings', data.listing_overview.rented_listings],
        ['Verified Listings', data.listing_overview.verified_listings],
        ['Vacancy Rate', `${data.vacancy_rate?.overall?.overall_vacancy_rate || 0}%`]
      ];

      metrics.forEach(([label, value]) => {
        doc.text(`${label}: `, 50, doc.y, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(value.toLocaleString(), { width: 250 });
        doc.font('Helvetica');
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // Property Types
    if (data.property_types?.distribution?.length) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Property Type Distribution', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      data.property_types.distribution.slice(0, 10).forEach(item => {
        doc.text(`${item.property_type}: `, 50, doc.y, { continued: true });
        doc.font('Helvetica-Bold').text(`${item.count} (${item.percentage}%)`, { continued: true });
        doc.font('Helvetica').text(` | Avg Rent: Rs. ${parseFloat(item.avg_rent).toFixed(0)}`);
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // Location Distribution
    if (data.locations?.by_city?.length) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Listings by City', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      data.locations.by_city.slice(0, 10).forEach(item => {
        doc.text(`${item.city}: `, 50, doc.y, { continued: true });
        doc.font('Helvetica-Bold').text(`${item.count} listings`, { continued: true });
        doc.font('Helvetica').text(` | Avg Rent: Rs. ${parseFloat(item.avg_rent).toFixed(0)} | Rented: ${item.rented_count}`);
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // User Statistics
    if (data.user_stats?.overall) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('User Statistics', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      const userMetrics = [
        ['Total Users', data.user_stats.overall.total_users],
        ['Tenants', data.user_stats.overall.total_tenants],
        ['Landlords', data.user_stats.overall.total_landlords],
        ['Verified Users', data.user_stats.overall.verified_users],
        ['New Users (30d)', data.user_stats.last_30_days?.new_users || 0]
      ];

      userMetrics.forEach(([label, value]) => {
        doc.text(`${label}: `, 50, doc.y, { continued: true });
        doc.font('Helvetica-Bold').text(value.toLocaleString());
        doc.font('Helvetica');
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // Financial Summary
    if (data.financial_reports?.overall) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Financial Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      const financial = [
        ['Total Revenue', `Rs. ${parseFloat(data.financial_reports.overall.total_revenue || 0).toFixed(2)}`],
        ['Collected Revenue', `Rs. ${parseFloat(data.financial_reports.overall.collected_revenue || 0).toFixed(2)}`],
        ['Pending Revenue', `Rs. ${parseFloat(data.financial_reports.overall.pending_revenue || 0).toFixed(2)}`],
        ['Total Transactions', data.financial_reports.overall.total_transactions],
        ['Avg Commission', `Rs. ${parseFloat(data.financial_reports.overall.avg_commission || 0).toFixed(2)}`]
      ];

      financial.forEach(([label, value]) => {
        doc.text(`${label}: `, 50, doc.y, { continued: true });
        doc.font('Helvetica-Bold').text(typeof value === 'number' ? value.toLocaleString() : value);
        doc.font('Helvetica');
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // Demand vs Supply Analysis
    if (data.demand_supply?.length) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Demand vs Supply Analysis', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').fillColor('#000000');

      // Summary stats
      const highDemand = data.demand_supply.filter(d => d.market_status === 'High Demand - Low Supply').length;
      const lowDemand = data.demand_supply.filter(d => d.market_status === 'Low Demand - High Supply').length;
      const balanced = data.demand_supply.filter(d => d.market_status === 'Balanced Market').length;

      doc.fontSize(10).text(`High Demand Zones: ${highDemand} | Low Demand Zones: ${lowDemand} | Balanced Markets: ${balanced}`);
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('City', 50, doc.y, { continued: true, width: 80 });
      doc.text('Type', 130, doc.y, { continued: true, width: 70 });
      doc.text('Supply', 200, doc.y, { continued: true, width: 50 });
      doc.text('Demand', 250, doc.y, { continued: true, width: 50 });
      doc.text('D/S Ratio', 300, doc.y, { continued: true, width: 60 });
      doc.text('Status', 360, doc.y, { width: 150 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.2);

      // Table content
      doc.font('Helvetica').fontSize(8);
      data.demand_supply.slice(0, 30).forEach(item => {
        if (doc.y > 700) doc.addPage();
        const startY = doc.y;
        doc.text(item.city || 'All', 50, startY, { width: 80 });
        doc.text(item.property_type || 'All', 130, startY, { width: 70 });
        doc.text(item.supply.toString(), 200, startY, { width: 50 });
        doc.text(item.demand.toString(), 250, startY, { width: 50 });
        doc.text(item.demand_supply_ratio?.toFixed(2) || 'N/A', 300, startY, { width: 60 });
        doc.text(item.market_status || 'N/A', 360, startY, { width: 150 });
        doc.moveDown(0.5);
      });
      doc.moveDown(0.5);
    }

    // Price Elasticity
    if (data.price_elasticity?.length) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Price Elasticity Analysis', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      doc.text('Relationship between pricing and rental velocity');
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Type', 50, doc.y, { continued: true, width: 80 });
      doc.text('City', 130, doc.y, { continued: true, width: 80 });
      doc.text('Avg Price', 210, doc.y, { continued: true, width: 80 });
      doc.text('Median Price', 290, doc.y, { continued: true, width: 80 });
      doc.text('Days to Rent', 370, doc.y, { continued: true, width: 80 });
      doc.text('Rentals', 450, doc.y, { width: 80 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.2);

      // Table content
      doc.font('Helvetica').fontSize(8);
      data.price_elasticity.slice(0, 25).forEach(item => {
        if (doc.y > 700) doc.addPage();
        const startY = doc.y;
        doc.text(item.type || 'N/A', 50, startY, { width: 80 });
        doc.text(item.city || 'N/A', 130, startY, { width: 80 });
        doc.text(`Rs. ${parseFloat(item.avg_price).toFixed(0)}`, 210, startY, { width: 80 });
        doc.text(`Rs. ${parseFloat(item.median_price).toFixed(0)}`, 290, startY, { width: 80 });
        doc.text(`${parseFloat(item.avg_days_to_rent).toFixed(0)} days`, 370, startY, { width: 80 });
        doc.text(item.rental_count.toString(), 450, startY, { width: 80 });
        doc.moveDown(0.5);
      });
    }
  }

  /**
   * Add listing data to PDF
   */
  addListingDataToPDF(doc, data) {
    doc.fillColor('#000000');
    
    if (data.listing_overview) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Detailed Listing Report');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      Object.entries(data.listing_overview).forEach(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        doc.text(`${label}: `, 50, doc.y, { continued: true });
        doc.font('Helvetica-Bold').text(value.toLocaleString());
        doc.font('Helvetica');
        doc.moveDown(0.3);
      });

      // Property Types
      if (data.property_types?.distribution?.length) {
        doc.moveDown(1);
        if (doc.y > 650) doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Property Type Breakdown');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#000000');

        data.property_types.distribution.forEach(item => {
          doc.text(`${item.property_type}: ${item.count} (${item.percentage}%) - Avg Rent: Rs. ${parseFloat(item.avg_rent).toFixed(0)}`);
          doc.moveDown(0.3);
        });
      }
    }
  }

  /**
   * Add user data to PDF
   */
  addUserDataToPDF(doc, data) {
    doc.fillColor('#000000');
    
    if (data.user_stats) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('User Analytics Report');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      if (data.user_stats.overall) {
        Object.entries(data.user_stats.overall).forEach(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          doc.text(`${label}: `, 50, doc.y, { continued: true });
          doc.font('Helvetica-Bold').text(value.toLocaleString());
          doc.font('Helvetica');
          doc.moveDown(0.3);
        });
      }

      // By Role
      if (data.user_stats.by_role?.length) {
        doc.moveDown(1);
        if (doc.y > 650) doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Users by Role');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#000000');

        data.user_stats.by_role.forEach(item => {
          doc.text(`${item.role}: ${item.count} users`);
          doc.moveDown(0.3);
        });
      }
    }
  }

  /**
   * Add financial data to PDF
   */
  addFinancialDataToPDF(doc, data) {
    doc.fillColor('#000000');
    
    if (data.financial_reports?.overall) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Financial Report');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      Object.entries(data.financial_reports.overall).forEach(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const formattedValue = typeof value === 'number' ? 
          (key.includes('revenue') || key.includes('commission') || key.includes('amount') ? 
            `Rs. ${value.toFixed(2)}` : value.toLocaleString()) : value;
        doc.text(`${label}: `, 50, doc.y, { continued: true });
        doc.font('Helvetica-Bold').text(formattedValue);
        doc.font('Helvetica');
        doc.moveDown(0.3);
      });

      // Revenue by Property Type
      if (data.financial_reports.by_property_type?.length) {
        doc.moveDown(1);
        if (doc.y > 650) doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Revenue by Property Type');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#000000');

        data.financial_reports.by_property_type.forEach(item => {
          doc.text(`${item.property_type}: Rs. ${parseFloat(item.total_revenue).toFixed(0)} (${item.transaction_count} transactions)`);
          doc.moveDown(0.3);
        });
      }
    }
  }

  /**
   * Add rental activity data to PDF
   */
  addRentalActivityToPDF(doc, data) {
    doc.fillColor('#000000');
    
    if (data.rental_activity) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Rental Activity Report');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      doc.text(`Rentals (Last 15 Days): ${data.rental_activity.last_15_days || 0}`);
      doc.moveDown(0.5);

      if (data.rental_activity.this_month?.length) {
        doc.text('This Month Activity:');
        doc.moveDown(0.3);
        data.rental_activity.this_month.forEach(item => {
          doc.text(`${item.property_type}: ${item.active_rentals} rentals, Avg Rent: Rs. ${parseFloat(item.avg_rent).toFixed(0)}`);
          doc.moveDown(0.2);
        });
      }

      // Bookings
      if (data.rental_activity.bookings) {
        doc.moveDown(1);
        if (doc.y > 650) doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Booking Statistics');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#000000');

        const bookings = data.rental_activity.bookings;
        doc.text(`Total Bookings: ${bookings.total_bookings}`);
        doc.text(`Confirmed: ${bookings.confirmed}`);
        doc.text(`Pending: ${bookings.pending}`);
        doc.text(`Cancelled: ${bookings.cancelled}`);
      }
    }
  }

  /**
   * Add advanced analytics data to PDF (new method for advanced tab)
   */
  addAdvancedDataToPDF(doc, data) {
    doc.fillColor('#000000');
    
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Advanced Analytics Report');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text('Demand-Supply Analysis and Price Elasticity Insights');
    doc.moveDown(1);

    // Demand vs Supply Analysis
    if (data.demand_supply?.length) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Demand vs Supply Analysis');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      // Summary stats
      const highDemand = data.demand_supply.filter(d => d.market_status === 'High Demand - Low Supply').length;
      const lowDemand = data.demand_supply.filter(d => d.market_status === 'Low Demand - High Supply').length;
      const balanced = data.demand_supply.filter(d => d.market_status === 'Balanced Market').length;

      doc.text(`Market Segments Summary:`);
      doc.text(`  - High Demand Zones: ${highDemand}`);
      doc.text(`  - Low Demand Zones: ${lowDemand}`);
      doc.text(`  - Balanced Markets: ${balanced}`);
      doc.moveDown(0.5);

      // Key insights
      doc.fontSize(9).fillColor('#6B7280');
      doc.text('High Demand zones represent opportunities for new listings with high rental potential.');
      doc.text('Low Demand zones may require competitive pricing or enhanced marketing strategies.');
      doc.fillColor('#000000');
      doc.moveDown(1);

      // Table
      if (doc.y > 650) doc.addPage();
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('City', 50, doc.y, { continued: true, width: 80 });
      doc.text('Type', 130, doc.y, { continued: true, width: 70 });
      doc.text('Supply', 200, doc.y, { continued: true, width: 50 });
      doc.text('Demand', 250, doc.y, { continued: true, width: 50 });
      doc.text('D/S Ratio', 300, doc.y, { continued: true, width: 60 });
      doc.text('Status', 360, doc.y, { width: 150 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.2);

      doc.font('Helvetica').fontSize(8);
      data.demand_supply.slice(0, 35).forEach(item => {
        if (doc.y > 720) doc.addPage();
        const startY = doc.y;
        doc.text(item.city || 'All', 50, startY, { width: 80 });
        doc.text((item.property_type || 'All').substring(0, 10), 130, startY, { width: 70 });
        doc.text(item.supply.toString(), 200, startY, { width: 50 });
        doc.text(item.demand.toString(), 250, startY, { width: 50 });
        doc.text(item.demand_supply_ratio?.toFixed(2) || 'N/A', 300, startY, { width: 60 });
        doc.text((item.market_status || 'N/A').substring(0, 20), 360, startY, { width: 150 });
        doc.moveDown(0.4);
      });
      doc.moveDown(1);
    }

    // Price Elasticity
    if (data.price_elasticity?.length) {
      if (doc.y > 600) doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Price Elasticity Analysis');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      doc.text('Relationship between pricing and rental velocity (time to rent)');
      doc.moveDown(0.5);

      doc.fontSize(9).fillColor('#6B7280');
      doc.text('Properties priced below market median typically rent 2-3x faster.');
      doc.text('Strategic 5-10% price reduction can significantly decrease vacancy period.');
      doc.fillColor('#000000');
      doc.moveDown(1);

      // Table
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Type', 50, doc.y, { continued: true, width: 70 });
      doc.text('City', 120, doc.y, { continued: true, width: 80 });
      doc.text('Avg Price', 200, doc.y, { continued: true, width: 80 });
      doc.text('Median', 280, doc.y, { continued: true, width: 70 });
      doc.text('Days', 350, doc.y, { continued: true, width: 60 });
      doc.text('Rentals', 410, doc.y, { width: 50 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.2);

      doc.font('Helvetica').fontSize(8);
      data.price_elasticity.slice(0, 30).forEach(item => {
        if (doc.y > 720) doc.addPage();
        const startY = doc.y;
        doc.text((item.type || 'N/A').substring(0, 10), 50, startY, { width: 70 });
        doc.text((item.city || 'N/A').substring(0, 12), 120, startY, { width: 80 });
        doc.text(`Rs.${(parseFloat(item.avg_price)/1000).toFixed(0)}k`, 200, startY, { width: 80 });
        doc.text(`Rs.${(parseFloat(item.median_price)/1000).toFixed(0)}k`, 280, startY, { width: 70 });
        doc.text(`${parseFloat(item.avg_days_to_rent).toFixed(0)}d`, 350, startY, { width: 60 });
        doc.text(item.rental_count.toString(), 410, startY, { width: 50 });
        doc.moveDown(0.4);
      });
    }

    // Price Trends
    if (data.price_reports?.comparisons) {
      doc.moveDown(1);
      if (doc.y > 650) doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E40AF').text('Price Trends');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');

      const comp = data.price_reports.comparisons;
      doc.text(`Average Rent (Last 15 Days): Rs. ${parseFloat(comp.last_15_days).toFixed(0)}`);
      doc.text(`Average Rent (Last 30 Days): Rs. ${parseFloat(comp.last_30_days).toFixed(0)}`);
      doc.text(`Monthly Growth Rate: ${comp.monthly_growth_rate > 0 ? '+' : ''}${comp.monthly_growth_rate}%`);
    }
  }

  /**
   * Create email-ready report summary
   */
  createEmailSummary(data) {
    const summary = {
      subject: `GharKhoj Analytics Report - ${new Date().toLocaleDateString()}`,
      body: `
        <h2>GharKhoj Analytics Report</h2>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        
        <h3>Key Metrics</h3>
        <ul>
          <li><strong>Total Listings:</strong> ${data.listing_overview?.total_listings || 'N/A'}</li>
          <li><strong>Active Listings:</strong> ${data.listing_overview?.active_listings || 'N/A'}</li>
          <li><strong>Total Users:</strong> ${data.user_stats?.overall?.total_users || 'N/A'}</li>
          <li><strong>Total Revenue:</strong> Rs. ${parseFloat(data.financial_reports?.overall?.total_revenue || 0).toFixed(2)}</li>
          <li><strong>Vacancy Rate:</strong> ${data.vacancy_rate?.overall?.overall_vacancy_rate || 'N/A'}%</li>
        </ul>
        
        <p>Please find the detailed report attached.</p>
        
        <p><em>This is an automated report from GharKhoj Admin Dashboard.</em></p>
      `
    };
    
    return summary;
  }
}

export default new ExportService();
